'use client';

import { useState, useRef, useCallback, ReactNode } from 'react';
import { Upload, X, File, Image, Video, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface FileWithPreview extends File {
  preview?: string;
  id: string;
  progress?: number;
  error?: string;
}

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  onFileSelect?: (files: FileWithPreview[]) => void;
  onFileRemove?: (fileId: string) => void;
  onUpload?: (files: FileWithPreview[]) => Promise<void>;
  className?: string;
  disabled?: boolean;
  value?: FileWithPreview[];
  placeholder?: string;
  showPreview?: boolean;
  previewComponent?: (file: FileWithPreview) => ReactNode;
}

const defaultAllowedTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function FileUpload({
  accept,
  multiple = true,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = defaultAllowedTypes,
  onFileSelect,
  onFileRemove,
  onUpload,
  className,
  disabled = false,
  value = [],
  placeholder = 'Drag and drop files here, or click to browse',
  showPreview = true,
  previewComponent,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed`;
    }
    if (file.size > maxSize) {
      return `File size must be less than ${formatFileSize(maxSize)}`;
    }
    return null;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      if (!multiple && value.length + validFiles.length >= 1) {
        errors.push('Only one file is allowed');
        return;
      }

      if (value.length + validFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const fileWithPreview: FileWithPreview = {
        ...file,
        id: Math.random().toString(36).substring(2, 9),
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }

      validFiles.push(fileWithPreview);
    });

    if (errors.length > 0) {
      console.error('File validation errors:', errors);
    }

    if (validFiles.length > 0) {
      onFileSelect?.(validFiles);
    }
  }, [value, multiple, maxFiles, onFileSelect, validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const handleRemoveFile = useCallback((fileId: string) => {
    const file = value.find(f => f.id === fileId);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
    onFileRemove?.(fileId);
  }, [value, onFileRemove]);

  const handleUpload = async () => {
    if (!onUpload || value.length === 0) return;

    setIsUploading(true);
    try {
      await onUpload(value);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className={cn('w-full', className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          'transition-colors cursor-pointer border-2 border-dashed',
          isDragOver && 'border-primary bg-primary/5',
          disabled && 'cursor-not-allowed opacity-50',
          !isDragOver && !disabled && 'hover:border-primary/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Upload className={cn(
            'h-8 w-8 mb-4',
            isDragOver ? 'text-primary' : 'text-muted-foreground'
          )} />
          <p className="text-sm font-medium mb-2">
            {placeholder}
          </p>
          <p className="text-xs text-muted-foreground">
            {accept || `Supports: ${allowedTypes.map(type => type.split('/')[1]).join(', ')}`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max file size: {formatFileSize(maxSize)}
            {multiple && ` • Max files: ${maxFiles}`}
          </p>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept || allowedTypes.join(',')}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* File List */}
      {value.length > 0 && (
        <div className="mt-4 space-y-2">
          {value.map((file) => (
            <FilePreview
              key={file.id}
              file={file}
              onRemove={handleRemoveFile}
              showPreview={showPreview}
              customPreview={previewComponent?.(file)}
            />
          ))}

          {/* Upload Button */}
          {onUpload && (
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleUpload}
                disabled={isUploading || value.length === 0}
                className="min-w-24"
              >
                {isUploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FilePreviewProps {
  file: FileWithPreview;
  onRemove: (fileId: string) => void;
  showPreview: boolean;
  customPreview?: ReactNode;
}

function FilePreview({ file, onRemove, showPreview, customPreview }: FilePreviewProps) {
  const [showImageModal, setShowImageModal] = useState(false);

  if (customPreview) {
    return <div>{customPreview}</div>;
  }

  return (
    <>
      <Card>
        <CardContent className="flex items-center space-x-3 p-3">
          {/* File Icon/Preview */}
          <div className="flex-shrink-0">
            {showPreview && file.preview ? (
              <div className="relative">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-12 w-12 rounded object-cover"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowImageModal(true)}
                  className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/50 text-white h-12 w-12 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                {getFileIcon(file)}
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
            {file.progress !== undefined && (
              <Progress value={file.progress} className="mt-1 h-1" />
            )}
            {file.error && (
              <p className="text-xs text-destructive mt-1">{file.error}</p>
            )}
          </div>

          {/* Remove Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(file.id)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Image Preview Modal */}
      {showImageModal && file.preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={file.preview}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(file: FileWithPreview) {
  if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (file.type.startsWith('video/')) return <Video className="h-4 w-4" />;
  if (file.type === 'application/pdf') return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}