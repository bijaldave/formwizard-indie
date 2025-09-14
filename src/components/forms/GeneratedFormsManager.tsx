import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Eye, RefreshCw, Trash2, Calendar } from 'lucide-react';
import { GeneratedForm, DividendRow, Profile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { fillForm15G, profileToForm15GData } from '@/lib/pdf/fill15G';

interface GeneratedFormsManagerProps {
  forms: GeneratedForm[];
  onPreview: (form: GeneratedForm) => void;
  onDelete: (formId: string) => void;
  onRefile: (form: GeneratedForm) => void;
  templateFile: File | null;
}

export const GeneratedFormsManager = ({ 
  forms, 
  onPreview, 
  onDelete, 
  onRefile,
  templateFile 
}: GeneratedFormsManagerProps) => {
  const { toast } = useToast();
  const [refilingId, setRefilingId] = useState<string | null>(null);

  const handleDownload = (form: GeneratedForm) => {
    if (form.pdfBlob) {
      const url = URL.createObjectURL(form.pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = form.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleRefile = async (form: GeneratedForm) => {
    if (!templateFile) {
      toast({
        variant: 'destructive',
        title: 'Template Required',
        description: 'Please upload the Form 15G template PDF first.'
      });
      return;
    }

    setRefilingId(form.id);

    try {
      // Regenerate the form with current template
      const form15GData = profileToForm15GData(form.profileSnapshot, [form.dividend]);
      const pdfBytes = await fillForm15G(templateFile, form15GData, false);
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = form.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Form Refiled',
        description: 'Your form has been regenerated and downloaded successfully.'
      });

      // Call parent refile handler to update the stored form
      onRefile(form);

    } catch (error) {
      console.error('Refile error:', error);
      toast({
        variant: 'destructive',
        title: 'Refile Failed',
        description: error instanceof Error ? error.message : 'Failed to regenerate form.'
      });
    } finally {
      setRefilingId(null);
    }
  };

  if (forms.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Forms Generated</h3>
          <p className="text-muted-foreground">
            Generate your first Form 15G to see it appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {forms.map((form) => (
        <Card key={form.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {form.type}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  Generated on {new Date(form.generatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </CardDescription>
              </div>
              <Badge variant="secondary">
                ₹{form.totalAmount.toLocaleString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Stock:</span>
                <div className="font-medium">{form.dividend.symbol}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Name:</span>
                <div className="font-medium">{form.profileSnapshot.name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">PAN:</span>
                <div className="font-medium">{form.profileSnapshot.pan}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Amount:</span>
                <div className="font-medium text-success">₹{form.totalAmount.toLocaleString()}</div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-2">Stock Details:</h4>
              <div className="bg-muted p-3 rounded text-sm space-y-1">
                <div><span className="text-muted-foreground">Symbol:</span> <span className="font-medium">{form.dividend.symbol}</span></div>
                <div><span className="text-muted-foreground">Quantity:</span> <span className="font-medium">{form.dividend.qty.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">DPS:</span> <span className="font-medium">₹{form.dividend.dps}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-medium text-success">₹{form.dividend.total.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPreview(form)}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(form)}
                disabled={!form.pdfBlob}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRefile(form)}
                disabled={refilingId === form.id || !templateFile}
                className="flex-1"
              >
                {refilingId === form.id ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Refiling...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refile
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(form.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};