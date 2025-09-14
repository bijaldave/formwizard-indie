import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GeneratedForm } from '@/types';
import { Download, ExternalLink } from 'lucide-react';

interface FormPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: GeneratedForm | null;
}

export const FormPreviewDialog = ({ open, onOpenChange, form }: FormPreviewDialogProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (form?.pdfBlob && open) {
      const url = URL.createObjectURL(form.pdfBlob);
      setPdfUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
        setPdfUrl(null);
      };
    }
  }, [form?.pdfBlob, open]);

  const handleDownload = () => {
    if (form?.pdfBlob) {
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

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>{form.type} Preview</DialogTitle>
          <DialogDescription>
            Generated on {new Date(form.generatedAt).toLocaleDateString('en-IN')} • Total: ₹{form.totalAmount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-4">
          {pdfUrl ? (
            <div className="flex-1 border rounded-lg overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title={`${form.type} Preview`}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/30">
              <p className="text-muted-foreground">PDF preview not available</p>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleOpenInNewTab} disabled={!pdfUrl}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
            <Button onClick={handleDownload} disabled={!form.pdfBlob}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};