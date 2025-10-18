-- Create connections table for user relationships
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Create index for faster queries
CREATE INDEX idx_connections_requester ON public.connections(requester_id);
CREATE INDEX idx_connections_addressee ON public.connections(addressee_id);
CREATE INDEX idx_connections_status ON public.connections(status);

-- Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Policies for connections
CREATE POLICY "Users can view own connections"
  ON public.connections FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "Users can create connection requests"
  ON public.connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update connections they're involved in"
  ON public.connections FOR UPDATE
  USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "Users can delete their own connection requests"
  ON public.connections FOR DELETE
  USING (auth.uid() = requester_id);

-- Update chats table to require connection
-- First, let's add a constraint to ensure chats can only be created between connected users
ALTER TABLE public.chats 
ADD CONSTRAINT check_connection_exists 
CHECK (
  EXISTS (
    SELECT 1 FROM public.connections 
    WHERE (
      (requester_id = user1_id AND addressee_id = user2_id) OR
      (requester_id = user2_id AND addressee_id = user1_id)
    ) AND status = 'accepted'
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for connections
CREATE TRIGGER update_connections_updated_at 
  BEFORE UPDATE ON public.connections 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
