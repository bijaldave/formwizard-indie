import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Copy, Download, FileText, Wrench } from 'lucide-react';

interface FieldMapping {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  align?: 'left' | 'right' | 'center';
  maxWidth?: number;
}

interface ExtractionResult {
  success: boolean;
  formType: string;
  pageWidth: number;
  pageHeight: number;
  fieldMappings: Record<string, FieldMapping>;
  extractedFields: number;
  optimizationApplied: boolean;
  fallbackUsed?: boolean;
}

export default function CoordinateExtractorPage() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [results15G, setResults15G] = useState<ExtractionResult | null>(null);
  const [results15H, setResults15H] = useState<ExtractionResult | null>(null);
  const [activeTab, setActiveTab] = useState('15G');

  const extractCoordinates = async (formType: '15G' | '15H') => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('pdf-coordinate-extractor', {
        body: { formType }
      });

      if (error) {
        throw error;
      }

      if (formType === '15G') {
        setResults15G(data);
      } else {
        setResults15H(data);
      }

      toast.success(`Successfully extracted coordinates for Form ${formType}`, {
        description: `Found ${data.extractedFields} fields with optimized font sizes`
      });

    } catch (error) {
      console.error('Error extracting coordinates:', error);
      toast.error(`Failed to extract coordinates for Form ${formType}`, {
        description: error.message
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const copyToClipboard = (fieldMappings: Record<string, FieldMapping>, formType: string) => {
    const code = generateFieldMappingCode(fieldMappings, formType);
    navigator.clipboard.writeText(code);
    toast.success('Field mappings copied to clipboard!');
  };

  const generateFieldMappingCode = (fieldMappings: Record<string, FieldMapping>, formType: string) => {
    const entries = Object.entries(fieldMappings).map(([key, mapping]) => {
      const props = [`x: ${mapping.x}`, `y: ${mapping.y}`, `width: ${mapping.width}`, `height: ${mapping.height}`];
      
      if (mapping.fontSize) props.push(`fontSize: ${mapping.fontSize}`);
      if (mapping.align && mapping.align !== 'left') props.push(`align: '${mapping.align}'`);
      if (mapping.maxWidth) props.push(`maxWidth: ${mapping.maxWidth}`);

      return `  ${key}: { ${props.join(', ')} }`;
    });

    return `// Form ${formType} field mappings - Generated with coordinate extraction and font optimization
const FORM_${formType}_FIELDS: Record<string, FieldMapping> = {
${entries.join(',\n')}
};`;
  };

  const downloadFieldMappings = (fieldMappings: Record<string, FieldMapping>, formType: string) => {
    const code = generateFieldMappingCode(fieldMappings, formType);
    const blob = new Blob([code], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-${formType.toLowerCase()}-mappings.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderFieldMappings = (result: ExtractionResult) => {
    if (!result) return null;

    const fieldEntries = Object.entries(result.fieldMappings);
    const personalFields = fieldEntries.filter(([key]) => ['name', 'pan', 'status_individual', 'status_huf', 'previous_year', 'resident_indian', 'resident_nri', 'dob'].includes(key));
    const addressFields = fieldEntries.filter(([key]) => key.startsWith('addr_'));
    const contactFields = fieldEntries.filter(([key]) => ['email', 'phone'].includes(key));
    const taxFields = fieldEntries.filter(([key]) => key.startsWith('assessed_') || key === 'latest_ay');
    const incomeFields = fieldEntries.filter(([key]) => key.startsWith('income_') || key.startsWith('other_forms_'));
    const tableFields = fieldEntries.filter(([key]) => key.startsWith('incomeTbl_'));
    const signatureFields = fieldEntries.filter(([key]) => key === 'signature');

    const renderFieldGroup = (title: string, fields: [string, FieldMapping][], icon: React.ReactNode) => {
      if (fields.length === 0) return null;

      return (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            {icon}
            <h4 className="font-medium text-sm">{title}</h4>
            <Badge variant="secondary" className="text-xs">{fields.length} fields</Badge>
          </div>
          <div className="grid gap-2">
            {fields.map(([key, mapping]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs font-mono">
                <span className="font-medium text-primary">{key}</span>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>x:{mapping.x} y:{mapping.y}</span>
                  <span>w:{mapping.width} h:{mapping.height}</span>
                  <span className="text-accent-foreground">fs:{mapping.fontSize || 9}</span>
                  {mapping.maxWidth && <span>max:{mapping.maxWidth}</span>}
                  {mapping.align && mapping.align !== 'left' && <span>align:{mapping.align}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Form {result.formType} Field Mappings</h3>
            {result.fallbackUsed && <Badge variant="outline">Fallback Used</Badge>}
            {result.optimizationApplied && <Badge variant="default">Font Optimized</Badge>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(result.fieldMappings, result.formType)}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadFieldMappings(result.fieldMappings, result.formType)}
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          Page Size: {result.pageWidth} × {result.pageHeight} • Total Fields: {result.extractedFields}
        </div>

        {renderFieldGroup('Personal Information', personalFields, <FileText className="w-4 h-4" />)}
        {renderFieldGroup('Address', addressFields, <FileText className="w-4 h-4" />)}
        {renderFieldGroup('Contact', contactFields, <FileText className="w-4 h-4" />)}
        {renderFieldGroup('Tax Assessment', taxFields, <FileText className="w-4 h-4" />)}
        {renderFieldGroup('Income Information', incomeFields, <FileText className="w-4 h-4" />)}
        {renderFieldGroup('Investment Table', tableFields, <FileText className="w-4 h-4" />)}
        {renderFieldGroup('Signature', signatureFields, <FileText className="w-4 h-4" />)}
      </div>
    );
  };

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Wrench className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">PDF Coordinate Extractor</h1>
        </div>
        <p className="text-muted-foreground">
          Extract field coordinates from PDF forms with optimized font sizes for perfect field placement.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Form 15G Extraction
            </CardTitle>
            <CardDescription>
              Extract coordinates from the updated Form 15G template with investment table structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => extractCoordinates('15G')}
              disabled={isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Form 15G Coordinates'
              )}
            </Button>
            {results15G && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ Extracted {results15G.extractedFields} fields with font optimization
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Form 15H Extraction
            </CardTitle>
            <CardDescription>
              Extract coordinates from Form 15H template with age-based field adjustments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => extractCoordinates('15H')}
              disabled={isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Form 15H Coordinates'
              )}
            </Button>
            {results15H && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ Extracted {results15H.extractedFields} fields with font optimization
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(results15G || results15H) && (
        <Card>
          <CardHeader>
            <CardTitle>Extraction Results</CardTitle>
            <CardDescription>
              Review extracted coordinates and copy the optimized field mappings to your code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="15G" disabled={!results15G}>
                  Form 15G {results15G && `(${results15G.extractedFields} fields)`}
                </TabsTrigger>
                <TabsTrigger value="15H" disabled={!results15H}>
                  Form 15H {results15H && `(${results15H.extractedFields} fields)`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="15G">
                {renderFieldMappings(results15G)}
              </TabsContent>

              <TabsContent value="15H">
                {renderFieldMappings(results15H)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Font Size Optimization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Optimization Rules</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Width &lt; 50px: fontSize 7-8</li>
                <li>• Width 50-80px: fontSize 8</li>
                <li>• Width 80-120px: fontSize 9</li>
                <li>• Width &gt; 120px: fontSize 10</li>
                <li>• Checkboxes: fontSize 10</li>
                <li>• Table cells: fontSize 7</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Field Types</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Text fields with maxWidth padding</li>
                <li>• Checkbox fields with proper sizing</li>
                <li>• Table cells with right alignment for amounts</li>
                <li>• Address fields with consistent formatting</li>
                <li>• Investment table with 5-column structure</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}