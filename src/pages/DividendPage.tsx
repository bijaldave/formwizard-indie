import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getDividends, setDividends, getProfile, getGeneratedForms, addGeneratedForm, removeGeneratedForm } from '@/lib/storage';
import { DividendRow, Profile, GeneratedForm } from '@/types';
import { ArrowLeft, DollarSign, Calculator, FileText, Upload, History } from 'lucide-react';
import { fillForm15G, profileToForm15GData } from '@/lib/pdf/fill15G';
import { fillForm15H, profileToForm15HData } from '@/lib/pdf/fill15H';
import { getFormType, getFormDisplayName, calculateAge } from '@/lib/utils/ageUtils';
import { GeneratedFormsManager } from '@/components/forms/GeneratedFormsManager';
import { FormPreviewDialog } from '@/components/forms/FormPreviewDialog';

export const DividendPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dividends, setDividendsState] = useState<DividendRow[]>([]);
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [template15HFile, setTemplate15HFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedForms, setGeneratedFormsState] = useState<GeneratedForm[]>([]);
  const [previewForm, setPreviewForm] = useState<GeneratedForm | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const savedDividends = getDividends();
    const savedProfile = getProfile();
    const savedForms = getGeneratedForms();
    setDividendsState(savedDividends);
    setProfile(savedProfile);
    setGeneratedFormsState(savedForms);
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

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>, formType: '15g' | '15h') => {
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
      
      if (formType === '15g') {
        setTemplateFile(file);
      } else {
        setTemplate15HFile(file);
      }
      
      toast({
        title: 'Template uploaded',
        description: `${getFormDisplayName(formType)} template ready for processing.`
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

  const handleGenerateIndividualPDF = async (dividend: DividendRow) => {
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

    const formType = getFormType(profile as Profile);
    const requiredTemplate = formType === '15g' ? templateFile : template15HFile;
    
    if (!requiredTemplate) {
      toast({
        variant: 'destructive',
        title: 'Template Required',
        description: `Please upload the ${getFormDisplayName(formType)} template PDF first.`
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Check for debug mode
      const urlParams = new URLSearchParams(window.location.search);
      const debugMode = urlParams.get('debug') === '1';

      let pdfBytes: Uint8Array;
      let formDisplayName: string;

      if (formType === '15g') {
        const form15GData = profileToForm15GData(profile as Profile, [dividend]);
        pdfBytes = await fillForm15G(requiredTemplate, form15GData, debugMode);
        formDisplayName = 'Form 15G';
      } else {
        const form15HData = profileToForm15HData(profile as Profile, dividend);
        pdfBytes = await fillForm15H(requiredTemplate, form15HData, debugMode);
        formDisplayName = 'Form 15H';
      }

      // Download the generated PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const sanitizedName = profile.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'User';
      const date = new Date().toISOString().split('T')[0];
      link.download = `${formType.toUpperCase()}_${dividend.symbol}_${sanitizedName}_${date}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Save the generated form
      const generatedForm: GeneratedForm = {
        id: `form-${Date.now()}-${dividend.symbol}`,
        type: formType === '15g' ? 'Form15G' : 'Form15H',
        generatedAt: new Date().toISOString(),
        filename: `${formType.toUpperCase()}_${dividend.symbol}_${sanitizedName}_${date}.pdf`,
        dividend: dividend,
        profileSnapshot: profile as Profile,
        totalAmount: dividend.total,
        pdfBlob: blob
      };

      addGeneratedForm(generatedForm);
      setGeneratedFormsState([generatedForm, ...generatedForms]);

      // Mark dividend as filed
      const updatedDividends = dividends.map(d => 
        d.symbol === dividend.symbol 
          ? { 
              ...d, 
              status: 'filed' as const, 
              formType: formType,
              filedAt: new Date().toISOString()
            }
          : d
      );
      setDividendsState(updatedDividends);
      setDividends(updatedDividends);

      toast({
        title: `${formDisplayName} Generated`,
        description: `Your ${formDisplayName} for ${dividend.symbol} has been generated and downloaded successfully.`
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : `Failed to generate ${getFormDisplayName(formType)}. Please try again.`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewForm = (form: GeneratedForm) => {
    setPreviewForm(form);
    setShowPreview(true);
  };

  const handleDeleteForm = (formId: string) => {
    removeGeneratedForm(formId);
    setGeneratedFormsState(generatedForms.filter(f => f.id !== formId));
    toast({
      title: 'Form Deleted',
      description: 'The generated form has been removed.'
    });
  };

  const handleRefileForm = (form: GeneratedForm) => {
    // Update the form in storage with new timestamp
    const updatedForm = {
      ...form,
      generatedAt: new Date().toISOString()
    };
    
    const updatedForms = generatedForms.map(f => 
      f.id === form.id ? updatedForm : f
    );
    setGeneratedFormsState(updatedForms);
  };

  const readyCount = dividends.filter(d => d.status === 'ready').length;
  const filedCount = dividends.filter(d => d.status === 'filed').length;
  const totalDividend = dividends
    .filter(d => d.status === 'ready')
    .reduce((sum, d) => sum + d.total, 0);
  
  const userAge = profile.dob_ddmmyyyy ? calculateAge(profile.dob_ddmmyyyy) : 0;
  const formType = profile.dob_ddmmyyyy ? getFormType(profile as Profile) : '15g';

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

            <Tabs defaultValue="dividends" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dividends" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Dividend Entry
                </TabsTrigger>
                <TabsTrigger value="forms" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Generated Forms ({generatedForms.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dividends" className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{dividends.length}</div>
                    <div className="text-sm text-muted-foreground">Total Holdings</div>
                  </div>
                  <div className="p-4 bg-success/10 rounded-lg">
                    <div className="text-2xl font-bold text-success">{readyCount}</div>
                    <div className="text-sm text-muted-foreground">Ready to Generate</div>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{filedCount}</div>
                    <div className="text-sm text-muted-foreground">Already Filed</div>
                  </div>
                   <div className="p-4 bg-accent/10 rounded-lg">
                     <div className="text-2xl font-bold text-accent">₹{totalDividend.toLocaleString()}</div>
                     <div className="text-sm text-muted-foreground">Ready Amount</div>
                   </div>
                 </div>
                 
                 {/* Age and Form Type Info */}
                 {profile.dob_ddmmyyyy && (
                   <div className="mt-4 p-4 bg-info/10 rounded-lg">
                     <div className="text-sm text-muted-foreground">
                       Age: <span className="font-medium">{userAge} years</span> → 
                       Will generate: <span className="font-medium">{getFormDisplayName(formType)}</span>
                       {formType === '15h' && <span className="ml-2 text-amber-600">Senior citizen form</span>}
                     </div>
                   </div>
                 )}
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
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                           disabled={dividend.status === 'filed'}
                         />
                         <p className="text-xs text-muted-foreground mt-1">
                           Enter the declared dividend per share for this stock.
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
                       
                       <div className="flex flex-col gap-2">
                         {dividend.status === 'filed' ? (
                           <div className="p-2 bg-success/10 rounded border border-success/20">
                             <div className="text-sm font-medium text-success">
                               ✓ {dividend.formType?.toUpperCase()} Filed
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {dividend.filedAt && new Date(dividend.filedAt).toLocaleDateString()}
                             </div>
                           </div>
                         ) : (
                           <Button
                             onClick={() => handleGenerateIndividualPDF(dividend)}
                             disabled={isGenerating || !dividend.dps || dividend.dps <= 0}
                             className="w-full"
                             size="sm"
                           >
                             {isGenerating ? (
                               <>
                                 <Upload className="h-3 w-3 mr-1 animate-spin" />
                                 Generating...
                               </>
                             ) : (
                              <>
                                <FileText className="h-3 w-3 mr-1" />
                                Generate {getFormDisplayName(formType)}
                              </>
                            )}
                          </Button>
                        )}
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

            {/* Template Upload Section */}
            {dividends.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Form Templates
                  </CardTitle>
                  <CardDescription>
                    Upload the required form templates. Form selection is based on your age.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Form 15G Template */}
                  <div>
                    <Label htmlFor="template-15g-upload" className="text-sm font-medium">
                      Form 15G Template PDF (Age &lt; 60 years)
                    </Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Input
                        id="template-15g-upload"
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleTemplateUpload(e, '15g')}
                        className="flex-1"
                      />
                      {templateFile && (
                        <div className="text-sm text-success">
                          ✓ {templateFile.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form 15H Template */}
                  <div>
                    <Label htmlFor="template-15h-upload" className="text-sm font-medium">
                      Form 15H Template PDF (Age ≥ 60 years)
                    </Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Input
                        id="template-15h-upload"
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleTemplateUpload(e, '15h')}
                        className="flex-1"
                      />
                      {template15HFile && (
                        <div className="text-sm text-success">
                          ✓ {template15HFile.name}
                        </div>
                      )}
                    </div>
                  </div>

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
          </TabsContent>

          <TabsContent value="forms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Generated Forms
                </CardTitle>
                <CardDescription>
                  View, download, and refile your previously generated forms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GeneratedFormsManager
                  forms={generatedForms}
                  onPreview={handlePreviewForm}
                  onDelete={handleDeleteForm}
                  onRefile={handleRefileForm}
                  templateFile={templateFile}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <FormPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          form={previewForm}
        />
        </div>
      </div>
    </div>
  );
};