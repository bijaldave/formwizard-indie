import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getAuth, setAuth } from '@/lib/storage';
import { validatePhone, validatePIN } from '@/lib/validation';
import { createPINHash, verifyPIN } from '@/lib/crypto';
import { Shield, ArrowLeft } from 'lucide-react';

export const AuthPage = () => {
  const [mode, setMode] = useState<'enroll' | 'unlock'>('enroll');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const auth = getAuth();
    if (auth.phone) {
      setPhone(auth.phone);
      setMode('unlock');
    }
    if (auth.isAuthenticated) {
      navigate('/profile');
    }
  }, [navigate]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;
    
    const pinError = validatePIN(pin);
    if (pinError) newErrors.pin = pinError;
    
    if (mode === 'enroll' && pin !== confirmPin) {
      newErrors.confirmPin = 'PINs do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      if (mode === 'enroll') {
        const pinHash = await createPINHash(pin);
        setAuth({
          phone,
          pinHash,
          isAuthenticated: true,
          attempts: 0,
          lastAttempt: 0,
        });
        toast({ title: 'Account created successfully!' });
        navigate('/profile');
      } else {
        const auth = getAuth();
        
        // Check cooldown
        if (auth.attempts >= 5) {
          const cooldownEnd = auth.lastAttempt + 10 * 60 * 1000; // 10 minutes
          if (Date.now() < cooldownEnd) {
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 60000);
            toast({ 
              variant: 'destructive',
              title: `Too many attempts. Try again in ${remaining} minutes.` 
            });
            setLoading(false);
            return;
          }
        }
        
        const isValid = await verifyPIN(pin, auth.pinHash);
        
        if (isValid) {
          setAuth({
            ...auth,
            isAuthenticated: true,
            attempts: 0,
          });
          toast({ title: 'Welcome back!' });
          navigate('/profile');
        } else {
          const newAttempts = auth.attempts + 1;
          setAuth({
            ...auth,
            attempts: newAttempts,
            lastAttempt: Date.now(),
          });
          toast({ 
            variant: 'destructive',
            title: `Wrong PIN. ${5 - newAttempts} attempts left.` 
          });
        }
      }
    } catch (error) {
      toast({ 
        variant: 'destructive',
        title: 'Authentication failed. Please try again.' 
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit mx-auto mb-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>
            {mode === 'enroll' ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {mode === 'enroll' 
              ? 'PIN locks the app locally. No OTP required.' 
              : 'Enter your PIN to continue'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={mode === 'unlock'}
                className="mt-1"
              />
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <Label htmlFor="pin">
                {mode === 'enroll' ? 'Create PIN' : 'PIN'}
              </Label>
              <Input
                id="pin"
                type="password"
                placeholder="4 digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
                className="mt-1"
              />
              {errors.pin && (
                <p className="text-sm text-destructive mt-1">{errors.pin}</p>
              )}
            </div>

            {mode === 'enroll' && (
              <div>
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  placeholder="Repeat PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  maxLength={4}
                  className="mt-1"
                />
                {errors.confirmPin && (
                  <p className="text-sm text-destructive mt-1">{errors.confirmPin}</p>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Please wait...' : (mode === 'enroll' ? 'Create Account' : 'Unlock')}
            </Button>

            {mode === 'unlock' && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setMode('enroll');
                  setPhone('');
                  setPin('');
                  setConfirmPin('');
                  setErrors({});
                }}
              >
                Create New Account
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};