import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ParseResult } from '@/lib/holdings-parser';
import { FileSpreadsheet, RowsIcon, Target, AlertTriangle, CheckCircle } from 'lucide-react';

interface ParsingInfoCardProps {
  parsingInfo: ParseResult['parsingInfo'];
  holdingsCount: number;
}

export function ParsingInfoCard({ parsingInfo, holdingsCount }: ParsingInfoCardProps) {
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        {confidence}% confident
      </Badge>;
    } else if (confidence >= 60) {
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <Target className="h-3 w-3 mr-1" />
        {confidence}% confident
      </Badge>;
    } else {
      return <Badge variant="destructive">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {confidence}% confident
      </Badge>;
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-blue-50">
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">Sheet:</span>
            <Badge variant="outline" className="font-mono">{parsingInfo.sheetName}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <RowsIcon className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">Header:</span>
            <Badge variant="outline">Row {parsingInfo.headerRow}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary">Detection:</span>
            {getConfidenceBadge(parsingInfo.confidence)}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary">Result:</span>
            <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
              {holdingsCount} holdings from {parsingInfo.totalRows} data rows
            </Badge>
          </div>
        </div>
        
        {parsingInfo.warnings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-800">Data Cleaning Applied:</p>
                <ul className="text-sm text-orange-700 space-y-1">
                  {parsingInfo.warnings.map((warning, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-orange-600 rounded-full flex-shrink-0"></span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}