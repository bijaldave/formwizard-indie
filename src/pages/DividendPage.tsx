import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getDividends, setDividends, getProfile } from '@/lib/storage';
import { DividendRow, Profile } from '@/types';
import { ArrowLeft, DollarSign, Calculator, FileText, Upload } from 'lucide-react';
import { fillForm15G, profileToForm15GData } from '@/lib/pdf/fill15G';

export const DividendPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dividends, setDividendsState] = useState<DividendRow[]>([]);
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const savedDividends = getDividends();
    const savedProfile = getProfile();
    setDividendsState(savedDividends);
    setProfile(savedProfile);
  }, []);

  const handleDividendChange = (index: number, dps: string) => {
    const dpsNum = parseFloat(dps) || 0;
    const updatedDividends = [...dividends];
    updatedDividends[index] = {
      ...updatedDividends[index],
      dps: dpsNum,
      total: dpsNum * updatedDividends[index].qty,
    };
    setDividendsState(updatedDividends);
    setDividends(updatedDividends);
  };

  const handleStatusToggle = (index: number, ready: boolean) => {
    const updatedDividends = [...dividends];
    updatedDividends[index] = {
      ...updatedDividends[index],
      status: ready ? 'ready' : 'pending',
    };
    setDividendsState(updatedDividends);
    setDividends(updatedDividends);
  };

  const handleContinue = () => {
    const readyCount = dividends.filter(d => d.status === 'ready').length;
    if (readyCount === 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Please mark at least one stock as ready to generate forms' 
      });
      return;
    }
    navigate('/dashboard');
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload a PDF file.'
        });
        return;
      }
      setTemplateFile(file);
      toast({
        title: 'Template uploaded',
        description: 'Form 15G template ready for processing.'
      });
    }
  };

  const validateProfileData = (): string[] => {
    const missing: string[] = [];
    const requiredFields: (keyof Profile)[] = [
      'name', 'pan', 'status', 'residential_status', 'addr_flat', 'addr_premises',
      'addr_street', 'addr_area', 'addr_city', 'addr_state', 'addr_pin',
      'email', 'phone', 'assessed_to_tax', 'latest_ay', 'fy_label',
      'income_total_fy', 'boid'
    ];

    requiredFields.forEach(field => {
      if (!profile[field]) {
        missing.push(field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
      }
    });

    return missing;
  };

  const handleGeneratePDF = async () => {
    // Validate data completeness
    const missingFields = validateProfileData();
    if (missingFields.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Incomplete Profile',
        description: `Please complete your profile. Missing: ${missingFields.join(', ')}`
      });
      return;
    }

    const readyDividends = dividends.filter(d => d.status === 'ready');
    if (readyDividends.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Ready Dividends',
        description: 'Please mark at least one stock as ready before generating Form 15G.'
      });
      return;
    }

    if (!templateFile) {
      toast({
        variant: 'destructive',
        title: 'Template Required',
        description: 'Please upload the Form 15G template PDF first.'
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Check for debug mode
      const urlParams = new URLSearchParams(window.location.search);
      const debugMode = urlParams.get('debug') === '1';

      // Generate PDF
      const form15GData = profileToForm15GData(profile as Profile, readyDividends);
      const pdfBytes = await fillForm15G(templateFile, form15GData, debugMode);

      // Download the generated PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const sanitizedName = profile.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'User';
      const date = new Date().toISOString().split('T')[0];
      link.download = `Form15G_${sanitizedName}_${date}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Form 15G Generated',
        description: 'Your Form 15G has been generated and downloaded successfully.'
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate Form 15G. Please try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const readyCount = dividends.filter(d => d.status === 'ready').length;
  const totalDividend = dividends
    .filter(d => d.status === 'ready')
    .reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/holdings')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Holdings
          </Button>

          <div className="space-y-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Dividend Entry
                </CardTitle>
                <CardDescription>
                  Enter dividend per share for each stock. Mark stocks as ready when you want to generate forms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{dividends.length}</div>
                    <div className="text-sm text-muted-foreground">Total Holdings</div>
                  </div>
                  <div className="p-4 bg-success/10 rounded-lg">
                    <div className="text-2xl font-bold text-success">{readyCount}</div>
                    <div className="text-sm text-muted-foreground">Ready to Generate</div>
                  </div>
                  <div className="p-4 bg-accent/10 rounded-lg">
                    <div className="text-2xl font-bold text-accent">₹{totalDividend.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Dividend</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dividend Cards */}
            <div className="space-y-4">
              {dividends.map((dividend, index) => (
                <Card key={dividend.symbol} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {dividend.symbol}
                        </CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`ready-${index}`} className="text-sm">
                          Ready to generate
                        </Label>
                        <Switch
                          id={`ready-${index}`}
                          checked={dividend.status === 'ready'}
                          onCheckedChange={(checked) => handleStatusToggle(index, checked)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Quantity held
                        </Label>
                        <div className="text-lg font-semibold">
                          {dividend.qty.toLocaleString()}
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor={`dps-${index}`} className="text-sm font-medium">
                          Dividend per share (₹)
                        </Label>
                        <Input
                          id={`dps-${index}`}
                          type="number"
                          step="0.01"
                          value={dividend.dps || ''}
                          onChange={(e) => handleDividendChange(index, e.target.value)}
                          placeholder="0.00"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the declared dividend per share for this stock. We'll multiply by your quantity.
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Total dividend (₹)
                        </Label>
                        <div className="text-lg font-semibold text-success flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          {dividend.total.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {dividend.dps} × {dividend.qty.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {dividends.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Holdings Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Please upload your holdings first to enter dividend information.
                  </p>
                  <Button onClick={() => navigate('/holdings')}>
                    Go to Holdings
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Form 15G Generation */}
            {dividends.length > 0 && readyCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Generate Form 15G
                  </CardTitle>
                  <CardDescription>
                    Generate your Form 15G with the dividend information you've marked as ready.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template Upload */}
                  <div>
                    <Label htmlFor="template-upload" className="text-sm font-medium">
                      Upload Form 15G Template PDF
                    </Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Input
                        id="template-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handleTemplateUpload}
                        className="flex-1"
                      />
                      {templateFile && (
                        <div className="text-sm text-success">
                          ✓ {templateFile.name}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload the official Form 15G PDF template. Only the calibrated template will work correctly.
                    </p>
                  </div>

                  {/* Generation Button */}
                  <div className="flex gap-4">
                    <Button
                      onClick={handleGeneratePDF}
                      disabled={isGenerating || !templateFile}
                      className="flex-1"
                    >
                      {isGenerating ? (
                        <>
                          <Upload className="h-4 w-4 mr-2 animate-spin" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Generate Form 15G ({readyCount} stocks, ₹{totalDividend.toLocaleString()})
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Debug Mode Info */}
                  <div className="text-xs text-muted-foreground">
                    💡 Add <code>?debug=1</code> to the URL to enable debug overlay for troubleshooting alignment issues.
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {dividends.length > 0 && (
              <div className="flex gap-4">
                <Button onClick={handleContinue} className="flex-1">
                  Continue to Dashboard ({readyCount} stocks ready)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};