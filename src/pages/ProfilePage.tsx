import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getProfile, setProfile } from '@/lib/storage';
import { validatePAN, validateDOB, validateEmail, validatePhone, validateBOID, validatePinCode, getAgeFromDOB, getBasicExemptionLimit } from '@/lib/validation';
import { Profile } from '@/types';
import { ArrowLeft, User, MapPin, DollarSign, FileText, PenTool } from 'lucide-react';
import SignatureCanvas from 'signature_pad';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePad = useRef<SignatureCanvas | null>(null);
  const [profile, setProfileState] = useState<Partial<Profile>>({
    resident: true,
    status: 'Individual',
    assessed_to_tax: 'No',
    income_for_decl: 0,
    income_total_fy: 0,
    other_forms_count: 0,
    other_forms_amount: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);

  useEffect(() => {
    const savedProfile = getProfile();
    setProfileState(prev => ({ ...prev, ...savedProfile }));
  }, []);

  useEffect(() => {
    if (canvasRef.current && !signaturePad.current) {
      signaturePad.current = new SignatureCanvas(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      });
    }
  }, []);

  useEffect(() => {
    // Check if 15G acknowledgement is needed
    if (profile.dob_ddmmyyyy && profile.fy_label && profile.income_total_fy) {
      const age = getAgeFromDOB(profile.dob_ddmmyyyy);
      if (age < 60) {
        const basicExemption = getBasicExemptionLimit(profile.fy_label);
        setShowAcknowledgement(profile.income_total_fy > basicExemption);
      } else {
        setShowAcknowledgement(false);
      }
    }
  }, [profile.dob_ddmmyyyy, profile.fy_label, profile.income_total_fy]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!profile.name?.trim()) newErrors.name = 'Name is required';
    
    const panError = validatePAN(profile.pan || '');
    if (panError) newErrors.pan = panError;
    
    const dobError = validateDOB(profile.dob_ddmmyyyy || '');
    if (dobError) newErrors.dob_ddmmyyyy = dobError;
    
    if (!profile.addr_flat?.trim()) newErrors.addr_flat = 'Flat/Door/Block is required';
    if (!profile.addr_premises?.trim()) newErrors.addr_premises = 'Premises/Building is required';
    if (!profile.addr_street?.trim()) newErrors.addr_street = 'Road/Street is required';
    if (!profile.addr_area?.trim()) newErrors.addr_area = 'Area/Locality is required';
    if (!profile.addr_city?.trim()) newErrors.addr_city = 'Town/City is required';
    if (!profile.addr_state?.trim()) newErrors.addr_state = 'State is required';
    
    const pinError = validatePinCode(profile.addr_pin || '');
    if (pinError) newErrors.addr_pin = pinError;
    
    const emailError = validateEmail(profile.email || '');
    if (emailError) newErrors.email = emailError;
    
    const phoneError = validatePhone(profile.phone || '');
    if (phoneError) newErrors.phone = phoneError;
    
    const boidError = validateBOID(profile.boid || '');
    if (boidError) newErrors.boid = boidError;
    
    if (!profile.latest_ay?.trim()) newErrors.latest_ay = 'Latest Assessment Year is required';
    if (!profile.fy_label?.trim()) newErrors.fy_label = 'Previous Year is required';
    
    if (!signaturePad.current?.isEmpty()) {
      profile.signature = signaturePad.current?.toDataURL();
    }
    
    if (!profile.signature) newErrors.signature = 'Signature is required';
    
    if (showAcknowledgement && !profile.ack_15g_over_exemption) {
      newErrors.ack_15g_over_exemption = 'Acknowledgement is required for 15G filing';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      toast({ variant: 'destructive', title: 'Please fix all errors before continuing' });
      return;
    }
    
    if (!signaturePad.current?.isEmpty()) {
      profile.signature = signaturePad.current?.toDataURL();
    }
    
    setProfile(profile);
    toast({ title: 'Profile saved successfully!' });
    navigate('/holdings');
  };

  const clearSignature = () => {
    signaturePad.current?.clear();
    setProfileState(prev => ({ ...prev, signature: undefined }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/auth')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  This information will be used to fill your tax forms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={profile.name || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="As per PAN card"
                    />
                    {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="pan">PAN *</Label>
                    <Input
                      id="pan"
                      value={profile.pan || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                    {errors.pan && <p className="text-sm text-destructive mt-1">{errors.pan}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Required by law. Invalid PAN makes the declaration void.</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="dob">Date of Birth (DD/MM/YYYY) *</Label>
                  <Input
                    id="dob"
                    value={profile.dob_ddmmyyyy || ''}
                    onChange={(e) => setProfileState(prev => ({ ...prev, dob_ddmmyyyy: e.target.value }))}
                    placeholder="10/02/1992"
                  />
                  {errors.dob_ddmmyyyy && <p className="text-sm text-destructive mt-1">{errors.dob_ddmmyyyy}</p>}
                </div>

                <div>
                  <Label htmlFor="boid">BO ID (16-digit DP+Client) *</Label>
                  <Input
                    id="boid"
                    value={profile.boid || ''}
                    onChange={(e) => setProfileState(prev => ({ ...prev, boid: e.target.value }))}
                    placeholder="1234567890123456"
                    maxLength={16}
                  />
                  {errors.boid && <p className="text-sm text-destructive mt-1">{errors.boid}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Used as identification in Form 15G/15H.</p>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="addr_flat">Flat/Door/Block *</Label>
                    <Input
                      id="addr_flat"
                      value={profile.addr_flat || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, addr_flat: e.target.value }))}
                    />
                    {errors.addr_flat && <p className="text-sm text-destructive mt-1">{errors.addr_flat}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="addr_premises">Premises/Building *</Label>
                    <Input
                      id="addr_premises"
                      value={profile.addr_premises || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, addr_premises: e.target.value }))}
                    />
                    {errors.addr_premises && <p className="text-sm text-destructive mt-1">{errors.addr_premises}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="addr_street">Road/Street *</Label>
                    <Input
                      id="addr_street"
                      value={profile.addr_street || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, addr_street: e.target.value }))}
                    />
                    {errors.addr_street && <p className="text-sm text-destructive mt-1">{errors.addr_street}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="addr_area">Area/Locality *</Label>
                    <Input
                      id="addr_area"
                      value={profile.addr_area || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, addr_area: e.target.value }))}
                    />
                    {errors.addr_area && <p className="text-sm text-destructive mt-1">{errors.addr_area}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="addr_city">Town/City *</Label>
                    <Input
                      id="addr_city"
                      value={profile.addr_city || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, addr_city: e.target.value }))}
                    />
                    {errors.addr_city && <p className="text-sm text-destructive mt-1">{errors.addr_city}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="addr_state">State *</Label>
                    <Input
                      id="addr_state"
                      value={profile.addr_state || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, addr_state: e.target.value }))}
                    />
                    {errors.addr_state && <p className="text-sm text-destructive mt-1">{errors.addr_state}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="addr_pin">PIN *</Label>
                    <Input
                      id="addr_pin"
                      value={profile.addr_pin || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, addr_pin: e.target.value }))}
                      placeholder="400001"
                      maxLength={6}
                    />
                    {errors.addr_pin && <p className="text-sm text-destructive mt-1">{errors.addr_pin}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, email: e.target.value }))}
                    />
                    {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={profile.phone || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="9876543210"
                    />
                    {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Income Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Income Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="assessed"
                      checked={profile.assessed_to_tax === 'Yes'}
                      onCheckedChange={(checked) => 
                        setProfileState(prev => ({ 
                          ...prev, 
                          assessed_to_tax: checked ? 'Yes' : 'No' 
                        }))
                      }
                    />
                    <Label htmlFor="assessed">Assessed to tax under Income-tax Act, 1961</Label>
                  </div>
                  
                  {profile.assessed_to_tax === 'Yes' && (
                    <div>
                      <Label htmlFor="latest_ay">Latest Assessment Year *</Label>
                      <Input
                        id="latest_ay"
                        value={profile.latest_ay || ''}
                        onChange={(e) => setProfileState(prev => ({ ...prev, latest_ay: e.target.value }))}
                        placeholder="2023-24"
                      />
                      {errors.latest_ay && <p className="text-sm text-destructive mt-1">{errors.latest_ay}</p>}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fy_label">Previous Year (FY) *</Label>
                    <Input
                      id="fy_label"
                      value={profile.fy_label || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, fy_label: e.target.value }))}
                      placeholder="2023-24"
                    />
                    {errors.fy_label && <p className="text-sm text-destructive mt-1">{errors.fy_label}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="income_for_decl">Estimated income for which declaration is made (₹) *</Label>
                    <Input
                      id="income_for_decl"
                      type="number"
                      value={profile.income_for_decl || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, income_for_decl: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="income_total_fy">Estimated total income of the P.Y. (₹) *</Label>
                    <Input
                      id="income_total_fy"
                      type="number"
                      value={profile.income_total_fy || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, income_total_fy: Number(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="other_forms_count">No. of other 15G/15H forms filed *</Label>
                    <Input
                      id="other_forms_count"
                      type="number"
                      value={profile.other_forms_count || ''}
                      onChange={(e) => setProfileState(prev => ({ ...prev, other_forms_count: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="other_forms_amount">Aggregate amount of income in those forms (₹) *</Label>
                  <Input
                    id="other_forms_amount"
                    type="number"
                    value={profile.other_forms_amount || ''}
                    onChange={(e) => setProfileState(prev => ({ ...prev, other_forms_amount: Number(e.target.value) }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Acknowledgement for 15G */}
            {showAcknowledgement && (
              <Card className="border-warning">
                <CardHeader>
                  <CardTitle className="text-warning">Important Notice</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="ack_15g"
                      checked={profile.ack_15g_over_exemption || false}
                      onCheckedChange={(checked) => 
                        setProfileState(prev => ({ 
                          ...prev, 
                          ack_15g_over_exemption: !!checked 
                        }))
                      }
                    />
                    <div>
                      <Label htmlFor="ack_15g" className="text-sm">
                        I acknowledge my total income exceeds the basic exemption, and I still wish to file Form 15G.
                      </Label>
                    </div>
                  </div>
                  {errors.ack_15g_over_exemption && (
                    <p className="text-sm text-destructive mt-1">{errors.ack_15g_over_exemption}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Signature */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  Signature
                </CardTitle>
                <CardDescription>
                  Draw your signature in the box below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-border rounded-lg p-4">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="border border-border rounded w-full"
                    style={{ touchAction: 'none' }}
                  />
                  <div className="flex gap-2 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSignature}
                    >
                      Clear Signature
                    </Button>
                  </div>
                  {errors.signature && (
                    <p className="text-sm text-destructive mt-1">{errors.signature}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button onClick={handleSave} className="flex-1">
                Save & Continue to Holdings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};