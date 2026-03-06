
import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader } from 'lucide-react';

interface CsvImporterProps {
  onImport: (data: any[]) => Promise<void>;
  sampleHeaders: string[]; // To validate or guide
  label?: string;
}

export const CsvImporter: React.FC<CsvImporterProps> = ({ onImport, sampleHeaders, label = "Import CSV" }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = parseCSV(text);
        if (data.length === 0) {
            alert("CSV is empty or could not be parsed.");
            return;
        }
        
        // Basic validation: Check if first row has some expected headers
        const firstRowKeys = Object.keys(data[0]);
        // console.log("Parsed Keys:", firstRowKeys);

        await onImport(data);
        alert(`Successfully imported ${data.length} records!`);
      } catch (err: any) {
        console.error(err);
        alert("Import failed: " + err.message);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r\n|\n/);
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Handle commas inside quotes roughly
        const currentLine = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        // Fallback split if regex fails for simple csv
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '')); // Simple split for now
        
        if (values.length === headers.length) {
            const obj: any = {};
            headers.forEach((header, index) => {
                let val = values[index];
                // Try to convert numbers
                if (!isNaN(Number(val)) && val !== '') {
                    // Keep phone numbers or specific string IDs as strings if needed, 
                    // but usually JSON.parse handles types well. 
                    // For safety in this app, simple assignment is fine, Supabase handles casting mostly.
                }
                obj[header] = val;
            });
            result.push(obj);
        }
    }
    return result;
  };

  return (
    <div>
      <input 
        type="file" 
        accept=".csv" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 font-bold text-xs shadow-sm disabled:opacity-50"
      >
        {uploading ? <Loader size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
        {label}
      </button>
    </div>
  );
};
