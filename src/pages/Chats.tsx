import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

export default function Chats() {
  const [chats, setChats] = useState<any[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchChats();
    fetchConnectionRequests();
  }, []);

  useEffect(() => {
    // Set up real-time subscription for new messages and chat deletions
    const channel = supabase
      .channel('chats-list')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refresh chats when new message is added
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chats',
        },
        () => {
          // Refresh chats when a chat is deleted (disconnection)
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchChats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUser(user);

      // Only fetch chats for connected users
      const { data: chatsData } = await supabase
        .from('chats')
        .select(`
          *,
          user1:user1_id (id, full_name, avatar_url),
          user2:user2_id (id, full_name, avatar_url),
          messages (
            content,
            created_at,
            sender_id
          )
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      setChats(chatsData || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnectionRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if connections table exists first
      const { error: tableCheckError } = await supabase
        .from('connections')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        console.log('Connections table not available');
        setConnectionRequests([]);
        return;
      }

      const { data: requestsData } = await supabase
        .from('connections')
        .select(`
          *,
          requester:requester_id (full_name, avatar_url),
          addressee:addressee_id (full_name, avatar_url)
        `)
        .eq('addressee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setConnectionRequests(requestsData || []);
    } catch (error) {
      console.error('Error fetching connection requests:', error);
      setConnectionRequests([]);
    }
  };

  const handleAcceptConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Connection Accepted',
        description: 'You are now connected!',
      });

      fetchConnectionRequests();
    } catch (error) {
      console.error('Error accepting connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept connection',
        variant: 'destructive',
      });
    }
  };

  const handleRejectConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'rejected' })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Connection Rejected',
        description: 'Connection request has been rejected',
      });

      fetchConnectionRequests();
    } catch (error) {
      console.error('Error rejecting connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject connection',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border p-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold">Messages</h1>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-4">
        <Tabs defaultValue="chats" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chats" className="text-sm sm:text-base">Chats</TabsTrigger>
            <TabsTrigger value="requests" className="text-sm sm:text-base">
              <span className="hidden sm:inline">Requests</span>
              <span className="sm:hidden">Req</span>
              {connectionRequests.length > 0 && (
                <Badge variant="destructive" className="ml-1 sm:ml-2 text-xs">
                  {connectionRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chats" className="mt-4">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : chats.length > 0 ? (
              <div className="space-y-2">
                {chats.map((chat) => {
                  // Get current user to determine the other user
                  const otherUser = chat.user1_id === currentUser?.id ? chat.user2 : chat.user1;
                  // Get the most recent message (messages are ordered by created_at desc)
                  const lastMessage = chat.messages?.[0];

                  return (
                    <Card 
                      key={chat.id} 
                      className="cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/chat/${chat.id}`)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={otherUser?.avatar_url} />
                            <AvatarFallback>{otherUser?.full_name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold">{otherUser?.full_name}</h3>
                            {lastMessage && (
                              <p className="text-sm text-muted-foreground truncate">
                                {lastMessage.content}
                              </p>
                            )}
                          </div>
                          {lastMessage && (
                            <Badge variant="outline" className="text-xs">
                              {new Date(lastMessage.created_at).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No messages yet. Connect with other users to start chatting!
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            {connectionRequests.length > 0 ? (
              <div className="space-y-4">
                {connectionRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="pt-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14">
                          <AvatarImage src={request.requester?.avatar_url} />
                          <AvatarFallback>{request.requester?.full_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base truncate">{request.requester?.full_name}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Wants to connect with you
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptConnection(request.id)}
                            className="flex items-center justify-center gap-1 w-full sm:w-auto"
                          >
                            <Check className="h-4 w-4" />
                            <span className="hidden sm:inline">Accept</span>
                            <span className="sm:hidden">Accept</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectConnection(request.id)}
                            className="flex items-center justify-center gap-1 w-full sm:w-auto"
                          >
                            <X className="h-4 w-4" />
                            <span className="hidden sm:inline">Reject</span>
                            <span className="sm:hidden">Reject</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No connection requests
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
}
