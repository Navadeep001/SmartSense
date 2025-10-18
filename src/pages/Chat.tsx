import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [chat, setChat] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchChat();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Set up real-time subscription for new messages
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${id}`,
        },
        (payload) => {
          const newMessage = payload.new;
          setMessages(prev => [...prev, newMessage]);
          
          // Scroll to bottom when new message arrives
          setTimeout(() => {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUser(user);

      // Get chat details
      const { data: chatData } = await supabase
        .from('chats')
        .select(`
          *,
          user1:user1_id (id, full_name, avatar_url),
          user2:user2_id (id, full_name, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (!chatData) {
        toast({
          title: 'Chat Not Found',
          description: 'This chat does not exist.',
          variant: 'destructive',
        });
        navigate('/chats');
        return;
      }

      setChat(chatData);

      // Determine the other user
      const otherUserData = chatData.user1_id === user.id ? chatData.user2 : chatData.user1;
      setOtherUser(otherUserData);

      // Fetch messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (full_name, avatar_url)
        `)
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

      setMessages(messagesData || []);

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('chat_id', id)
        .neq('sender_id', user.id);

    } catch (error) {
      console.error('Error fetching chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !id) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: id,
          sender_id: user.id,
          content: newMessage.trim()
        })
        .select(`
          *,
          sender:sender_id (full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      setNewMessage('');

      // Scroll to bottom
      setTimeout(() => {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border p-4">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/chats')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Avatar className="h-10 w-10">
            <AvatarImage src={otherUser?.avatar_url} />
            <AvatarFallback>{otherUser?.full_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{otherUser?.full_name}</h1>
            <p className="text-sm text-muted-foreground">Online</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        <div 
          id="messages-container"
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.sender_id === currentUser?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[80%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isOwnMessage && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={message.sender?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {message.sender?.full_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <Card className={`${isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <CardContent className="p-3">
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(message.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input */}
        <div className="border-t border-border p-4">
          <div className="max-w-screen-xl mx-auto flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1"
              disabled={sending}
            />
            <Button 
              onClick={sendMessage} 
              disabled={!newMessage.trim() || sending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
