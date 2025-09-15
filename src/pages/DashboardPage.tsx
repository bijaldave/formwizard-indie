import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getHoldings, getDividends, setDividends, getProfile, getGeneratedForms, addGeneratedForm, removeGeneratedForm, resetHoldingsData, logout } from '@/lib/storage';
import { DividendRow, Profile, GeneratedForm } from '@/types';
import { isProfileComplete } from '@/lib/validation';
import { getFormType, getFormDisplayName, calculateAge } from '@/lib/utils/ageUtils';
import { generateForm } from '@/lib/pdf/fillAcro';
import { loadEmbeddedTemplate } from '@/lib/templateLoader';
import { profileToForm15GData, fillForm15G } from '@/lib/pdf/fill15G';
import { profileToForm15HData, fillForm15H } from '@/lib/pdf/fill15H';
import { DividendEntryDialog } from '@/components/forms/DividendEntryDialog';
import { FormPreviewDialog } from '@/components/forms/FormPreviewDialog';

import { ArrowLeft, FileText, AlertCircle, CheckCircle, Clock, Download, Upload, Eye, RefreshCw, LogOut, Trash2, MoreVertical, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dividends, setDividendsState] = useState<DividendRow[]>([]);
  const [profile, setProfileState] = useState<Partial<Profile>>({});
  const [generatedForms, setGeneratedFormsState] = useState<GeneratedForm[]>([]);
  const [selectedDividend, setSelectedDividend] = useState<DividendRow | null>(null);
  const [showDividendDialog, setShowDividendDialog] = useState(false);
  const [previewForm, setPreviewForm] = useState<GeneratedForm | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [acroTemplatesAvailable, setAcroTemplatesAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const savedHoldings = getHoldings();
    const savedDividends = getDividends();
    const savedProfile = getProfile();
    const savedForms = getGeneratedForms();
    
    // Convert holdings to dividend format for display
    const holdingDividends: DividendRow[] = savedHoldings.map(holding => {
      const existingDividend = savedDividends.find(d => d.symbol === holding.symbol);
      return existingDividend || {
        symbol: holding.symbol,
        qty: holding.qty,
        dps: 0,
        total: 0,
        status: 'pending'
      };
    });
    
    setDividendsState(holdingDividends);
    setProfileState(savedProfile);
    setGeneratedFormsState(savedForms);
  }, []);

  // Preflight check for AcroForm template availability
  useEffect(() => {
    const checkAcroTemplates = async () => {
      try {
        const [form15G, form15H] = await Promise.all([
          fetch('/templates/15G.acro.pdf', { method: 'HEAD' }),
          fetch('/templates/15H.acro.pdf', { method: 'HEAD' })
        ]);
        setAcroTemplatesAvailable(form15G.ok && form15H.ok);
      } catch (error) {
        console.warn('Could not check AcroForm template availability:', error);
        setAcroTemplatesAvailable(false);
      }
    };

    checkAcroTemplates();
  }, []);

  const handleDividendSave = (updatedDividend: DividendRow) => {
    const updatedDividends = dividends.map(d => 
      d.symbol === updatedDividend.symbol ? updatedDividend : d
    );
    setDividendsState(updatedDividends);
    setDividends(updatedDividends);
  };

  const handleEnterDividend = (dividend: DividendRow) => {
    setSelectedDividend(dividend);
    setShowDividendDialog(true);
  };

  const validateProfileData = (): string[] => {
    const missing: string[] = [];
    const requiredFields: (keyof Profile)[] = [
      'name', 'pan', 'status', 'residential_status', 'addr_flat', 'addr_premises',
      'addr_street', 'addr_area', 'addr_city', 'addr_state', 'addr_pin',
      'email', 'phone', 'assessed_to_tax', 'latest_ay', 'fy_label', 'boid'
    ];

    requiredFields.forEach(field => {
      if (!profile[field]) {
        missing.push(field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
      }
    });

    // Check for either new or legacy fields
    if (!profile.estimatedIncomeTotal && !profile.income_total_fy) {
      missing.push('Estimated Total Income');
    }

    return missing;
  };

  const handleGenerateForm = async (dividend: DividendRow) => {
    // Always prompt for dividend if not set or if status is pending
    if (dividend.status === 'pending' || dividend.dps === 0) {
      handleEnterDividend(dividend);
      return;
    }

    // Validate profile completeness
    const missingFields = validateProfileData();
    if (missingFields.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Incomplete Profile',
        description: `Please complete your profile. Missing: ${missingFields.join(', ')}`
      });
      return;
    }

    setIsGenerating(true);

    try {
      let blob: Blob;
      let formType: '15g' | '15h';
      let filename: string;

      try {
        // Try AcroForm approach first
        const result = await generateForm(profile as Profile, dividend);
        blob = result.blob;
        formType = result.formType;
        filename = result.filename;
      } catch (acroError) {
        // Fall back to legacy coordinate-based filling
        console.warn('AcroForm generation failed, falling back to legacy templates:', acroError);
        
        toast({
          title: 'Using Legacy Templates',
          description: 'AcroForm templates not found, using coordinate-based filling.',
          variant: 'default'
        });

        formType = getFormType(profile as Profile);
        const templateFile = await loadEmbeddedTemplate(formType);
        
        if (formType === '15g') {
          const form15GData = profileToForm15GData(profile as Profile, dividend);
          const pdfBytes = await fillForm15G(templateFile, form15GData, false);
          blob = new Blob([pdfBytes], { type: 'application/pdf' });
        } else {
          const form15HData = profileToForm15HData(profile as Profile, dividend);
          const pdfBytes = await fillForm15H(templateFile, form15HData, false);
          blob = new Blob([pdfBytes], { type: 'application/pdf' });
        }
        
        // Generate legacy filename
        const sanitizedName = profile.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'User';
        filename = `Form15${formType.toUpperCase()}_${profile.fy_label || 'FY'}_${sanitizedName}_${dividend.symbol}.pdf`;
      }
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Save the generated form
      const generatedForm: GeneratedForm = {
        id: `form-${Date.now()}-${dividend.symbol}`,
        type: formType === '15g' ? 'Form15G' : 'Form15H',
        generatedAt: new Date().toISOString(),
        filename,
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

      const formDisplayName = getFormDisplayName(formType);
      toast({
        title: `${formDisplayName} Generated`,
        description: `Your ${formDisplayName} for ${dividend.symbol} has been generated and downloaded successfully.`
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate form. Please try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewForm = (dividend: DividendRow) => {
    const form = generatedForms.find(f => f.dividend.symbol === dividend.symbol);
    if (form) {
      setPreviewForm(form);
      setShowPreview(true);
    }
  };

  const handleRefileForm = async (dividend: DividendRow) => {
    await handleGenerateForm(dividend);
  };

  const handleRefileFormBySymbol = async (symbol: string) => {
    const dividend = dividends.find(d => d.symbol === symbol);
    if (dividend) {
      await handleGenerateForm(dividend);
    }
  };

  const getActionButton = (dividend: DividendRow) => {
    const profileComplete = isProfileComplete(profile);
    
    switch (dividend.status) {
      case 'pending':
        return (
          <Button
            size="sm"
            onClick={() => handleEnterDividend(dividend)}
            className="w-full"
          >
            Enter Dividend
          </Button>
        );
      
      case 'ready':
        return (
          <Button
            size="sm"
            onClick={() => handleGenerateForm(dividend)}
            disabled={!profileComplete || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Upload className="h-3 w-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-3 w-3 mr-1" />
                Generate Form
              </>
            )}
          </Button>
        );
      
      case 'filed':
        const form = generatedForms.find(f => f.dividend.symbol === dividend.symbol);
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleViewForm(dividend)}
              disabled={!form}
              className="flex-1"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRefileFormBySymbol(dividend.symbol)}
              disabled={!profileComplete || isGenerating}
              className="flex-1"
              title="Generate new form"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        );
    }
  };

  const getStatusIcon = (status: DividendRow['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'ready':
        return <AlertCircle className="h-4 w-4" />;
      case 'filed':
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: DividendRow['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'ready':
        return <Badge variant="default">Ready</Badge>;
      case 'filed':
        return <Badge variant="outline" className="text-success border-success">Filed</Badge>;
    }
  };

  const readyDividends = dividends.filter(d => d.status === 'ready');
  const filedDividends = dividends.filter(d => d.status === 'filed');
  const totalDividend = dividends.reduce((sum, d) => sum + d.total, 0);
  const age = profile.dob_ddmmyyyy ? calculateAge(profile.dob_ddmmyyyy) : 0;
  const formType = age < 60 ? '15G' : '15H';

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged out successfully',
      description: 'You have been logged out of your account.'
    });
    navigate('/auth');
  };

  const handleResetHoldings = () => {
    resetHoldingsData();
    setDividendsState([]);
    setGeneratedFormsState([]);
    toast({
      title: 'Holdings data reset',
      description: 'All holdings, dividends, and generated forms have been cleared.'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Holdings Dashboard
                    </CardTitle>
                    <CardDescription>
                      Manage your dividend-paying stocks and generate forms
                    </CardDescription>
                  </div>
                  
                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate('/profile')}>
                        Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {/* Calibration menu items removed - using AcroForm templates now */}
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Reset Holdings Data
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Holdings Data</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all your holdings, dividends, and generated forms. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetHoldings} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Reset Data
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {acroTemplatesAvailable === false && (
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                          AcroForm Templates Missing
                        </h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Using legacy coordinate-based templates. For better reliability, add AcroForm templates to{' '}
                          <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">public/templates/</code>.{' '}
                          <a href="/templates/README.md" target="_blank" className="underline">View instructions</a>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{dividends.length}</div>
                    <div className="text-sm text-muted-foreground">Total Holdings</div>
                  </div>
                  <div className="p-4 bg-warning/10 rounded-lg">
                    <div className="text-2xl font-bold text-warning">{readyDividends.length}</div>
                    <div className="text-sm text-muted-foreground">Ready to File</div>
                  </div>
                  <div className="p-4 bg-success/10 rounded-lg">
                    <div className="text-2xl font-bold text-success">{filedDividends.length}</div>
                    <div className="text-sm text-muted-foreground">Forms Filed</div>
                  </div>
                  <div className="p-4 bg-accent/10 rounded-lg">
                    <div className="text-2xl font-bold text-accent">₹{totalDividend.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Dividend</div>
                  </div>
                </div>
                
                {/* Age and Form Type Info */}
                {profile.dob_ddmmyyyy && (
                  <div className="mt-4 p-4 bg-info/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      Age: <span className="font-medium">{age} years</span> → 
                      Will generate: <span className="font-medium">{formType}</span>
                      {age >= 60 && <span className="ml-2 text-amber-600">Senior citizen form</span>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Profile Status */}
            {!isProfileComplete(profile) && (
              <Card className="border-warning">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <div>
                      <h3 className="font-medium">Profile Incomplete</h3>
                      <p className="text-sm text-muted-foreground">
                        Complete your profile to generate forms
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/profile')}
                      className="ml-auto"
                    >
                      Complete Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Holdings Table */}
            <Card>
              <CardHeader>
                <CardTitle>Your Holdings</CardTitle>
                <CardDescription>
                  Enter dividends and generate forms for your stocks
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dividends.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">DPS (₹)</TableHead>
                        <TableHead className="text-right">Total (₹)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dividends.map((dividend, index) => (
                        <TableRow key={dividend.symbol}>
                          <TableCell>
                            <div className="font-medium">{dividend.symbol}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {dividend.qty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {dividend.dps > 0 ? `₹${dividend.dps}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {dividend.total > 0 ? `₹${dividend.total.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(dividend.status)}
                              {getStatusBadge(dividend.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getActionButton(dividend)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Holdings Found</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload your holdings to get started.
                    </p>
                    <Button onClick={() => navigate('/holdings')}>
                      Upload Holdings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/profile')}
                className="h-auto p-4 justify-start"
              >
                <div className="text-left">
                  <div className="font-medium">Edit Profile</div>
                  <div className="text-sm text-muted-foreground">Update personal information</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/holdings')}
                className="h-auto p-4 justify-start"
              >
                <div className="text-left">
                  <div className="font-medium">Manage Holdings</div>
                  <div className="text-sm text-muted-foreground">Add or update holdings</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dividend Entry Dialog */}
      {selectedDividend && (
        <DividendEntryDialog
          open={showDividendDialog}
          onOpenChange={setShowDividendDialog}
          dividend={selectedDividend}
          onSave={handleDividendSave}
        />
      )}

      {/* Form Preview Dialog */}
      <FormPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        form={previewForm}
      />
    </div>
  );
};