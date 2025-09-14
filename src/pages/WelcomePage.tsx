import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, FileText, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-primary/10 rounded-full">
              <FileText className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-foreground mb-6">
            File 15G/15H in minutes
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            One profile. Upload holdings. Generate compliant forms per stock.
          </p>
          <p className="text-sm text-muted-foreground mb-8 flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-success" />
            Your data stays on this device
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardContent className="pt-8">
              <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Quick Setup</h3>
              <p className="text-muted-foreground">Enter your profile once and generate forms for all your dividend-paying stocks</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-8">
              <div className="p-3 bg-success/10 rounded-full w-fit mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Compliant Forms</h3>
              <p className="text-muted-foreground">Auto-generates Part A of official 15G/15H forms with correct field mapping</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-8">
              <div className="p-3 bg-info/10 rounded-full w-fit mx-auto mb-4">
                <Shield className="h-6 w-6 text-info" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure & Private</h3>
              <p className="text-muted-foreground">All data stored locally. No uploads to servers. Your PAN and BO ID stay safe</p>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button 
            size="lg" 
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-4 text-lg"
            onClick={() => navigate('/auth')}
          >
            Start Filing
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Never fill 15G/15H manually again
          </p>
        </div>
      </div>
    </div>
  );
};