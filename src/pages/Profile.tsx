import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LogOut, UserPlus, MessageCircle, Check, X, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import BottomNav from '@/components/BottomNav';
import PostCard from '@/components/PostCard';

export default function Profile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('none'); // 'none', 'pending', 'accepted', 'rejected'
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
    if (!isOwnProfile && id) {
      checkConnectionStatus();
    }
  }, [id, isOwnProfile]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileId = id || user.id;
      setIsOwnProfile(profileId === user.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      setProfile(profileData);

      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      setPosts(postsData || []);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) return;

      // Check if connections table exists first
      const { error: tableCheckError } = await supabase
        .from('connections')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        // Fallback: Check if chat exists (simulating connection)
        console.log('Using fallback: checking existing chats');
        const { data: existingChat } = await supabase
          .from('chats')
          .select('*')
          .or(`and(user1_id.eq.${user.id},user2_id.eq.${id}),and(user1_id.eq.${id},user2_id.eq.${user.id})`)
          .single();

        if (existingChat) {
          setConnectionStatus('accepted');
          setConnectionId(existingChat.id);
        } else {
          setConnectionStatus('none');
          setConnectionId(null);
        }
        return;
      }

      // Check if there's an existing connection
      const { data: connection } = await supabase
        .from('connections')
        .select('*')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
        .single();

      if (connection) {
        setConnectionStatus(connection.status);
        setConnectionId(connection.id);
      } else {
        setConnectionStatus('none');
        setConnectionId(null);
      }
    } catch (error) {
      // If no connection found, set to 'none' (this is expected)
      console.log('No connection found, showing connect button');
      setConnectionStatus('none');
      setConnectionId(null);
    }
  };

  const handleConnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) return;

      // Try to use connections table first
      const { error: tableCheckError } = await supabase
        .from('connections')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        // Fallback: Create a chat directly (simulating connection)
        console.log('Using fallback: creating chat directly');
        
        // Check if chat already exists
        const { data: existingChat } = await supabase
          .from('chats')
          .select('*')
          .or(`and(user1_id.eq.${user.id},user2_id.eq.${id}),and(user1_id.eq.${id},user2_id.eq.${user.id})`)
          .single();

        if (existingChat) {
          toast({
            title: 'Already Connected',
            description: 'You are already connected to this user.',
            variant: 'destructive',
          });
          return;
        }

        // Create new chat
        const { data: chat, error: chatError } = await supabase
          .from('chats')
          .insert({
            user1_id: user.id,
            user2_id: id
          })
          .select()
          .single();

        if (chatError) {
          throw chatError;
        }

        setConnectionStatus('accepted');
        setConnectionId(chat.id);
        
        toast({
          title: 'Connected!',
          description: 'You are now connected and can start chatting.',
        });
        return;
      }

      // Use connections table if it exists
      const { data, error } = await supabase
        .from('connections')
        .insert({
          requester_id: user.id,
          addressee_id: id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Already Connected',
            description: 'You have already sent a connection request to this user.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      setConnectionStatus('pending');
      setConnectionId(data.id);
      
      toast({
        title: 'Connection Request Sent',
        description: 'Your connection request has been sent!',
      });
    } catch (error) {
      console.error('Error sending connection request:', error);
      toast({
        title: 'Error',
        description: `Failed to send connection request: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleAcceptConnection = async () => {
    try {
      if (!connectionId) return;

      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('id', connectionId);

      if (error) throw error;

      setConnectionStatus('accepted');
      
      toast({
        title: 'Connection Accepted',
        description: 'You are now connected!',
      });
    } catch (error) {
      console.error('Error accepting connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept connection',
        variant: 'destructive',
      });
    }
  };

  const handleRejectConnection = async () => {
    try {
      if (!connectionId) return;

      const { error } = await supabase
        .from('connections')
        .update({ status: 'rejected' })
        .eq('id', connectionId);

      if (error) throw error;

      setConnectionStatus('rejected');
      
      toast({
        title: 'Connection Rejected',
        description: 'Connection request has been rejected',
      });
    } catch (error) {
      console.error('Error rejecting connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject connection',
        variant: 'destructive',
      });
    }
  };

  const handleStartChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) return;

      // Check if chat already exists
      const { data: existingChat } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${id}),and(user1_id.eq.${id},user2_id.eq.${user.id})`)
        .single();

      if (existingChat) {
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat
      const { data: chat, error } = await supabase
        .from('chats')
        .insert({
          user1_id: user.id,
          user2_id: id
        })
        .select()
        .single();

      if (error) throw error;

      navigate(`/chat/${chat.id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to start chat',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) return;

      // Check if connections table exists first
      const { error: tableCheckError } = await supabase
        .from('connections')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        // Fallback: Delete chat if connections table doesn't exist
        console.log('Using fallback: deleting chat');
        
        const { error: chatError } = await supabase
          .from('chats')
          .delete()
          .or(`and(user1_id.eq.${user.id},user2_id.eq.${id}),and(user1_id.eq.${id},user2_id.eq.${user.id})`);

        if (chatError) {
          throw chatError;
        }

        setConnectionStatus('none');
        setConnectionId(null);
        
        toast({
          title: 'Disconnected',
          description: 'You have been disconnected from this user.',
        });
        return;
      }

      // Use connections table if it exists
      const { error } = await supabase
        .from('connections')
        .delete()
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`);

      if (error) throw error;

      setConnectionStatus('none');
      setConnectionId(null);
      
      toast({
        title: 'Disconnected',
        description: 'You have been disconnected from this user.',
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect from user',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-to-r from-primary to-accent p-4 sm:p-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-foreground">Profile</h1>
          {isOwnProfile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-white/20"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-4 -mt-8">
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-xl sm:text-2xl">
                    {profile?.full_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold truncate">{profile?.full_name}</h2>
                  <p className="text-sm sm:text-base text-muted-foreground truncate">{profile?.email}</p>
                  <Badge className="mt-1 sm:mt-2 text-xs sm:text-sm">{profile?.role}</Badge>
                </div>
              </div>
              
              {!isOwnProfile && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {connectionStatus === 'none' && (
                    <Button 
                      onClick={handleConnect} 
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="hidden sm:inline">Connect</span>
                      <span className="sm:hidden">Connect</span>
                    </Button>
                  )}
                  {connectionStatus === 'pending' && (
                    <Button 
                      variant="outline" 
                      disabled 
                      className="w-full sm:w-auto"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Pending
                    </Button>
                  )}
                  {connectionStatus === 'accepted' && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button 
                        onClick={handleStartChat} 
                        className="flex items-center justify-center gap-2 w-full sm:w-auto"
                        size="sm"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">Message</span>
                        <span className="sm:hidden">Message</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline"
                            className="flex items-center justify-center gap-2 w-full sm:w-auto"
                            size="sm"
                          >
                            <UserMinus className="h-4 w-4" />
                            <span className="hidden sm:inline">Disconnect</span>
                            <span className="sm:hidden">Disconnect</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect from {profile?.full_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove your connection and you won't be able to message each other anymore. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                  {connectionStatus === 'rejected' && (
                    <Button 
                      onClick={handleConnect} 
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="hidden sm:inline">Connect Again</span>
                      <span className="sm:hidden">Connect</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {profile?.bio && (
              <p className="text-sm mb-4">{profile.bio}</p>
            )}

            {profile?.interests && profile.interests.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest: string) => (
                    <Badge key={interest} variant="outline">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <section>
          <h3 className="text-lg sm:text-xl font-semibold mb-4">Posts</h3>
          {posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onUpdate={fetchProfile} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No posts yet
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
