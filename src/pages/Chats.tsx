import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import BottomNav from '@/components/BottomNav';

export default function Chats() {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: chatsData } = await supabase
        .from('chats')
        .select(`
          *,
          user1:user1_id (full_name, avatar_url),
          user2:user2_id (full_name, avatar_url),
          messages (
            content,
            created_at
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border p-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-2xl font-bold">Messages</h1>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : chats.length > 0 ? (
          <div className="space-y-2">
            {chats.map((chat) => {
              const otherUser = chat.user1_id === chat.user_id ? chat.user2 : chat.user1;
              const lastMessage = chat.messages?.[0];

              return (
                <Card key={chat.id} className="cursor-pointer hover:bg-muted transition-colors">
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
            No messages yet
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
