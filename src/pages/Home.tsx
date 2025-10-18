import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search as SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import PostCard from '@/components/PostCard';

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile with interests
      const { data: profile } = await supabase
        .from('profiles')
        .select('interests')
        .eq('id', user.id)
        .single();

      // Fetch posts
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filter by interests if available
      let filteredPosts = postsData || [];
      if (profile?.interests && profile.interests.length > 0) {
        filteredPosts = postsData?.filter(post =>
          profile.interests.some((interest: string) =>
            post.category.toLowerCase().includes(interest.toLowerCase())
          )
        ) || [];
      }

      setPosts(filteredPosts);

      // Get top reacted posts
      const topReacted = [...(postsData || [])]
        .sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count))
        .slice(0, 5);

      setTopPosts(topReacted);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border p-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
            Innovest
          </h1>
          <div className="relative" onClick={() => navigate('/search')}>
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Search ideas..."
              className="pl-10"
              readOnly
            />
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-4 space-y-6">
        {topPosts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Top Reacted Posts</h2>
            <div className="space-y-4">
              {topPosts.map((post) => (
                <PostCard key={post.id} post={post} onUpdate={fetchPosts} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold mb-4">Your Feed</h2>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onUpdate={fetchPosts} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No posts yet. Start following some interests!
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
