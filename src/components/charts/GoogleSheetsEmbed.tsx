import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const GoogleSheetsEmbed = () => {
  // Convert the Google Sheets URL to embed format
  const sheetsUrl = "https://docs.google.com/spreadsheets/d/1lPIjg_EFqNhmQh9jddIH9hIKZoVs_NKy/edit?gid=251556616&embedded=true";
  
  return (
    <Card className="w-full h-full">
      <CardContent className="p-0 h-full">
        <iframe
          src={sheetsUrl}
          className="w-full h-[calc(100vh-6rem)]"
          frameBorder="0"
          title="Google Sheets Data"
        />
      </CardContent>
    </Card>
  );
};

export default GoogleSheetsEmbed; 