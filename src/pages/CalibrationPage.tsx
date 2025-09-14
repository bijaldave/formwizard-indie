import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Download, Move, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadEmbeddedTemplate } from '@/lib/templateLoader';
import { saveCalibrationData, loadCalibrationData, buildAcroFormShell } from '@/lib/pdf/calibration';
import * as pdfjsLib from 'pdfjs-dist';

// Field definitions for each form type
const FORM_FIELDS = {
  '15G': [
    { key: 'name', label: 'Name' },
    { key: 'pan', label: 'PAN' },
    { key: 'addr_line1', label: 'Address Line 1' },
    { key: 'addr_line2', label: 'Address Line 2' },
    { key: 'addr_line3', label: 'Address Line 3' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'resident_yes', label: 'Resident Yes' },
    { key: 'resident_no', label: 'Resident No' },
    { key: 'assessed_yes', label: 'Assessed Yes' },
    { key: 'assessed_no', label: 'Assessed No' },
    { key: 'income_ident', label: 'Income Identification' },
    { key: 'income_nature', label: 'Income Nature' },
    { key: 'income_section', label: 'Income Section' },
    { key: 'income_amount', label: 'Income Amount' },
    { key: 'place_date', label: 'Place & Date' },
    { key: 'declaration_amount', label: 'Declaration Amount' },
    { key: 'signature_box', label: 'Signature' }
  ],
  '15H': [
    { key: 'name', label: 'Name' },
    { key: 'pan', label: 'PAN' },
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'resident_yes', label: 'Resident Yes' },
    { key: 'resident_no', label: 'Resident No' },
    { key: 'assessed_yes', label: 'Assessed Yes' },
    { key: 'assessed_no', label: 'Assessed No' },
    { key: 'income_ident', label: 'Income Identification' },
    { key: 'income_nature', label: 'Income Nature' },
    { key: 'income_section', label: 'Income Section' },
    { key: 'income_amount', label: 'Income Amount' },
    { key: 'place_date', label: 'Place & Date' },
    { key: 'declaration_amount', label: 'Declaration Amount' },
    { key: 'signature_box', label: 'Signature' }
  ]
};

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CalibrationData {
  [key: string]: Rectangle;
}

export const CalibrationPage = () => {
  const { formType } = useParams<{ formType: '15G' | '15H' }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [calibrationData, setCalibrationData] = useState<CalibrationData>({});
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);

  useEffect(() => {
    if (!formType || !['15G', '15H'].includes(formType)) {
      navigate('/dashboard');
      return;
    }
    
    loadPDF();
    loadExistingCalibration();
  }, [formType]);

  const loadPDF = async () => {
    try {
      const templateFile = await loadEmbeddedTemplate(formType!.toLowerCase() as '15g' | '15h');
      const arrayBuffer = await templateFile.arrayBuffer();
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      setPdfDoc({ pdf, page });
      
      const viewport = page.getViewport({ scale: 1 });
      setPageWidth(viewport.width);
      setPageHeight(viewport.height);
      
      renderPDF(page);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load PDF template'
      });
    }
  };

  const renderPDF = async (page: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: 1.5 });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    await page.render({ canvasContext: context, viewport }).promise;
    
    // Draw field overlays
    drawFieldOverlays(context, viewport.scale);
  };

  const drawFieldOverlays = (context: CanvasRenderingContext2D, scale: number) => {
    Object.entries(calibrationData).forEach(([fieldKey, rect]) => {
      const x = rect.x * scale;
      const y = rect.y * scale;
      const width = rect.width * scale;
      const height = rect.height * scale;

      // Draw rectangle
      context.strokeStyle = selectedField === fieldKey ? '#ff0000' : '#00ff00';
      context.lineWidth = 2;
      context.strokeRect(x, y, width, height);

      // Draw label
      context.fillStyle = '#000000';
      context.font = '12px Arial';
      context.fillRect(x, y - 20, context.measureText(fieldKey).width + 8, 20);
      context.fillStyle = '#ffffff';
      context.fillText(fieldKey, x + 4, y - 6);
    });
  };

  const loadExistingCalibration = async () => {
    try {
      const data = await loadCalibrationData(formType!);
      setCalibrationData(data);
    } catch (error) {
      console.log('No existing calibration data found');
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedField || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX / 1.5; // Accounting for PDF scale
    const y = (e.clientY - rect.top) * scaleY / 1.5;

    const newRect: Rectangle = {
      x: x - 50, // Default width/2
      y: y - 10, // Default height/2
      width: 100,
      height: 20
    };

    setCalibrationData(prev => ({
      ...prev,
      [selectedField]: newRect
    }));

    // Re-render with new overlay
    if (pdfDoc?.page) {
      renderPDF(pdfDoc.page);
    }
  };

  const handleSaveCalibration = async () => {
    try {
      await saveCalibrationData(formType!, calibrationData);
      toast({
        title: 'Calibration Saved',
        description: `Field coordinates for Form ${formType} have been saved successfully.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save calibration data'
      });
    }
  };

  const handleBuildAcroForm = async () => {
    try {
      const templateFile = await loadEmbeddedTemplate(formType!.toLowerCase() as '15g' | '15h');
      await buildAcroFormShell(templateFile, calibrationData, formType!);
      
      toast({
        title: 'AcroForm Shell Built',
        description: `Fillable PDF template for Form ${formType} has been created successfully.`
      });
    } catch (error) {
      console.error('Error building AcroForm:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to build AcroForm shell'
      });
    }
  };

  const handleResetCalibration = () => {
    setCalibrationData({});
    if (pdfDoc?.page) {
      renderPDF(pdfDoc.page);
    }
  };

  const fields = FORM_FIELDS[formType as keyof typeof FORM_FIELDS] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Controls Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Form {formType} Calibration</CardTitle>
                <CardDescription>
                  Click on a field below, then click on the PDF to place it
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {fields.map(field => (
                    <Button
                      key={field.key}
                      variant={selectedField === field.key ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSelectedField(field.key)}
                    >
                      <Move className="h-3 w-3 mr-2" />
                      {field.label}
                      {calibrationData[field.key] && <span className="ml-auto text-green-500">✓</span>}
                    </Button>
                  ))}
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Button
                    onClick={handleSaveCalibration}
                    className="w-full"
                    disabled={Object.keys(calibrationData).length === 0}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Calibration
                  </Button>
                  
                  <Button
                    onClick={handleBuildAcroForm}
                    variant="outline"
                    className="w-full"
                    disabled={Object.keys(calibrationData).length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Build AcroForm
                  </Button>
                  
                  <Button
                    onClick={handleResetCalibration}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset All
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Progress: {Object.keys(calibrationData).length}/{fields.length} fields placed</p>
                </div>
              </CardContent>
            </Card>

            {/* PDF Canvas */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>PDF Template - Form {formType}</CardTitle>
                <CardDescription>
                  {selectedField 
                    ? `Click on the PDF to place: ${fields.find(f => f.key === selectedField)?.label}`
                    : 'Select a field from the left panel to start positioning'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-auto max-h-[80vh]">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="cursor-crosshair"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};