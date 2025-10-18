import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: any;
  onUpdate: () => void;
}

export default function PostCard({ post, onUpdate }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLike = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (liked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);
        setLiked(false);
      } else {
        await supabase
          .from('likes')
          .insert({ user_id: user.id, post_id: post.id });
        setLiked(true);
      }

      onUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: post.title,
        text: post.description,
        url: window.location.href,
      });
    } catch (error) {
      toast({
        title: 'Copied to clipboard',
        description: 'Post link copied!',
      });
    }
  };

  const handleProfileClick = () => {
    navigate(`/profile/${post.user_id}`);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar 
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleProfileClick}
        >
          <AvatarImage src={post.profiles?.avatar_url} />
          <AvatarFallback>{post.profiles?.full_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div 
          className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleProfileClick}
        >
          <p className="font-semibold">{post.profiles?.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="secondary">{post.type}</Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <h3 className="text-xl font-bold mb-2">{post.title}</h3>
          <p className="text-muted-foreground">{post.description}</p>
        </div>

        {post.image_url && (
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-64 object-cover rounded-lg"
          />
        )}

        <div className="flex gap-2">
          <Badge>{post.category}</Badge>
          {post.tags?.map((tag: string) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          disabled={loading}
          className={liked ? 'text-red-500' : ''}
        >
          <Heart className={`h-5 w-5 mr-2 ${liked ? 'fill-current' : ''}`} />
          {post.likes_count}
        </Button>

        <Button variant="ghost" size="sm">
          <MessageCircle className="h-5 w-5 mr-2" />
          {post.comments_count}
        </Button>

        <Button variant="ghost" size="sm" onClick={handleShare}>
          <Share2 className="h-5 w-5 mr-2" />
          Share
        </Button>
      </CardFooter>
    </Card>
  );
}
