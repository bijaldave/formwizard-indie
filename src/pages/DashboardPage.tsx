import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getDividends, setDividends, getProfile } from '@/lib/storage';
import { DividendRow, Profile } from '@/types';
import { getAgeFromDOB, isProfileComplete } from '@/lib/validation';
import { generatePDF, downloadPDF } from '@/lib/pdf-generator';
import { ArrowLeft, FileText, Download, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dividends, setDividendsState] = useState<DividendRow[]>([]);
  const [profile, setProfileState] = useState<Partial<Profile>>({});

  useEffect(() => {
    const savedDividends = getDividends();
    const savedProfile = getProfile();
    setDividendsState(savedDividends);
    setProfileState(savedProfile);
  }, []);

  const handleGenerateForm = async (dividend: DividendRow) => {
    if (!isProfileComplete(profile)) {
      toast({
        variant: 'destructive',
        title: 'Please complete your profile first',
        description: 'All fields in your profile are required to generate forms.'
      });
      navigate('/profile');
      return;
    }

    // Check if dividend amount is entered
    if (!dividend.dps || dividend.dps <= 0) {
      toast({
        variant: 'destructive',
        title: 'Please enter dividend per share',
        description: `Enter the dividend amount for ${dividend.symbol} first.`
      });
      navigate('/dividends');
      return;
    }

    // Determine form type based on age
    const age = getAgeFromDOB(profile.dob_ddmmyyyy || '');
    const formType = age < 60 ? '15G' : '15H';

    // Check 15G acknowledgement for high income
    if (formType === '15G' && profile.income_total_fy && profile.income_total_fy > 250000 && !profile.ack_15g_over_exemption) {
      toast({
        variant: 'destructive',
        title: 'Acknowledgement required',
        description: 'Please acknowledge the 15G filing for income above exemption limit.'
      });
      navigate('/profile');
      return;
    }

    try {
      const fileName = `Form${formType}_PartA_${profile.fy_label}_${profile.name?.replace(/\s+/g, '_')}_${dividend.symbol}.pdf`;
      
      // Generate PDF
      const pdfBytes = await generatePDF(profile as Profile, dividend);
      
      // Download PDF
      downloadPDF(pdfBytes, fileName);
      
      // Update dividend status to filed
      const updatedDividends = dividends.map(d => 
        d.symbol === dividend.symbol
          ? { ...d, status: 'filed' as const }
          : d
      );
      setDividendsState(updatedDividends);
      setDividends(updatedDividends);

      toast({
        title: `Form ${formType} generated successfully!`,
        description: `Generated for ${dividend.symbol} - ₹${dividend.total.toLocaleString()} dividend`,
      });
      
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to generate form',
        description: 'Please check your data and try again. Make sure the form template is available.'
      });
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
  const age = profile.dob_ddmmyyyy ? getAgeFromDOB(profile.dob_ddmmyyyy) : 0;
  const formType = age < 60 ? '15G' : '15H';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/dividends')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dividends
          </Button>

          <div className="space-y-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Holdings Dashboard
                </CardTitle>
                <CardDescription>
                  Generate Form {formType} for your dividend-paying stocks
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  Click "Generate Form" to create Form {formType} for each stock
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dividends.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
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
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(dividend.status)}
                              {getStatusBadge(dividend.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {dividend.status === 'ready' ? (
                              <Button
                                size="sm"
                                onClick={() => handleGenerateForm(dividend)}
                                disabled={!isProfileComplete(profile)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Generate PDF
                              </Button>
                            ) : dividend.status === 'filed' ? (
                              <Button size="sm" variant="outline" disabled>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Filed
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => navigate('/dividends')}
                              >
                                Enter Dividend
                              </Button>
                            )}
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
                      Upload your holdings to get started with form generation.
                    </p>
                    <Button onClick={() => navigate('/holdings')}>
                      Upload Holdings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/dividends')}
                className="h-auto p-4 justify-start"
              >
                <div className="text-left">
                  <div className="font-medium">Update Dividends</div>
                  <div className="text-sm text-muted-foreground">Modify dividend amounts</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};