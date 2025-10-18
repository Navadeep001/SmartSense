import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

export default function Investment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [investment, setInvestment] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvestment();
  }, [id]);

  const fetchInvestment = async () => {
    try {
      const { data: investmentData } = await supabase
        .from('investments')
        .select(`
          *,
          investor:investor_id (full_name, avatar_url),
          innovator:innovator_id (full_name, avatar_url),
          post:post_id (title, description)
        `)
        .eq('id', id)
        .single();

      setInvestment(investmentData);

      const { data: updatesData } = await supabase
        .from('investment_updates')
        .select('*')
        .eq('investment_id', id)
        .order('created_at', { ascending: false });

      setUpdates(updatesData || []);
    } catch (error) {
      console.error('Error fetching investment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!investment) {
    return <div className="flex items-center justify-center min-h-screen">Investment not found</div>;
  }

  const totalUsed = updates.reduce((sum, update) => sum + (parseFloat(update.amount_used) || 0), 0);
  const usagePercentage = (totalUsed / parseFloat(investment.amount)) * 100;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border p-4">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Investment Dashboard</h1>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{investment.post?.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Investment</p>
              <p className="text-2xl font-bold">${parseFloat(investment.amount).toLocaleString()}</p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Fund Usage</span>
                <span className="text-sm text-muted-foreground">
                  ${totalUsed.toLocaleString()} / ${parseFloat(investment.amount).toLocaleString()}
                </span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Investor</p>
                <p className="font-medium">{investment.investor?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Innovator</p>
                <p className="font-medium">{investment.innovator?.full_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section>
          <h2 className="text-xl font-semibold mb-4">Milestones & Updates</h2>
          {updates.length > 0 ? (
            <div className="space-y-4">
              {updates.map((update) => (
                <Card key={update.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{update.title}</h3>
                      {update.progress_percentage !== null && (
                        <span className="text-sm font-medium text-primary">
                          {update.progress_percentage}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{update.description}</p>
                    {update.amount_used && (
                      <p className="text-sm">
                        <span className="font-medium">Amount Used:</span> $
                        {parseFloat(update.amount_used).toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(update.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No updates yet</div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
