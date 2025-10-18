import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import PostCard from '@/components/PostCard';

export default function Search() {
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('reactions');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    searchPosts();
  }, [category, sortBy]);

  const searchPosts = async () => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('posts')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('visibility', 'public');

      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }

      if (category !== 'all') {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data } = await queryBuilder;

      let sortedData = data || [];
      if (sortBy === 'reactions') {
        sortedData.sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count));
      } else if (sortBy === 'recent') {
        sortedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      setPosts(sortedData);
    } catch (error) {
      console.error('Error searching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border p-4">
        <div className="max-w-screen-xl mx-auto space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Search</h1>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Search ideas..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchPosts()}
            />
          </div>

          <div className="flex gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Health">Health</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Environment">Environment</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reactions">Top Reacted</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={searchPosts} className="w-full">
            <SearchIcon className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-8">Searching...</div>
        ) : posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onUpdate={searchPosts} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {query ? 'No results found' : 'Enter a search query'}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
