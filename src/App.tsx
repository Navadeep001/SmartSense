import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Auth from '@/pages/Auth';
import Onboarding from '@/pages/Onboarding';
import Home from '@/pages/Home';
import Profile from '@/pages/Profile';
import NewPost from '@/pages/NewPost';
import Notifications from '@/pages/Notifications';
import Chats from '@/pages/Chats';
import Chat from '@/pages/Chat';
import Search from '@/pages/Search';
import Investment from '@/pages/Investment';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary to-accent">
        <div className="text-primary-foreground text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/onboarding" /> : <Auth />} />
      <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/auth" />} />
      <Route path="/" element={user ? <Home /> : <Navigate to="/auth" />} />
      <Route path="/profile/:id?" element={user ? <Profile /> : <Navigate to="/auth" />} />
      <Route path="/new-post" element={user ? <NewPost /> : <Navigate to="/auth" />} />
      <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/auth" />} />
      <Route path="/chats" element={user ? <Chats /> : <Navigate to="/auth" />} />
      <Route path="/chat/:id" element={user ? <Chat /> : <Navigate to="/auth" />} />
      <Route path="/search" element={user ? <Search /> : <Navigate to="/auth" />} />
      <Route path="/investment/:id" element={user ? <Investment /> : <Navigate to="/auth" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <AppContent />
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
