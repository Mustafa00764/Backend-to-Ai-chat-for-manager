"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

type FileType =
  | "AVATAR"
  | "CHAT_ATTACHMENT"
  | "IMAGE_ATTACHMENT"
  | "AUDIO_ATTACHMENT"
  | "VIDEO_ATTACHMENT"
  | "DOCUMENT_ATTACHMENT"
  | "KNOWLEDGE_IMPORT";

type AdminFile = {
  id: string;
  ownerId: string | null;
  bucket: string;
  s3Key: string;
  originalName: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  fileType: FileType;
  uploadStatus: string;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
};

type FilesResponse = {
  files: AdminFile[];
};

type DownloadResponse = {
  file: AdminFile;
  url: string;
  expiresIn: number;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;

  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${(mb / 1024).toFixed(1)} GB`;
}

async function fetchFiles(fileType: string) {
  const params = new URLSearchParams();

  if (fileType !== "ALL") {
    params.set("fileType", fileType);
  }

  const response = await fetch(`/api/admin-api/files?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Не удалось загрузить файлы");
  }

  return response.json() as Promise<FilesResponse>;
}

async function getDownloadUrl(fileId: string) {
  const response = await fetch(`/api/admin-api/files/${fileId}/download`);

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Не удалось получить ссылку");
  }

  return json as DownloadResponse;
}

async function deleteFile(fileId: string) {
  const response = await fetch(`/api/admin-api/files/${fileId}`, {
    method: "DELETE",
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Не удалось удалить файл");
  }

  return json;
}

export function FilesPageClient() {
  const queryClient = useQueryClient();
  type FileTypeFilter = "ALL" | FileType;

  const [fileType, setFileType] = useState<FileTypeFilter>("ALL");

  function handleFileTypeChange(value: string | null) {
    setFileType((value ?? "ALL") as FileTypeFilter);
  }

  const filesQuery = useQuery({
    queryKey: ["admin-files", fileType],
    queryFn: () => fetchFiles(fileType),
  });

  const downloadMutation = useMutation({
    mutationFn: getDownloadUrl,
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-files"],
      });

      toast.success("Файл удалён");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const files = filesQuery.data?.files ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Файлы</h1>
          <p className="text-muted-foreground">
            Файлы из S3 / MinIO: изображения, аудио, документы и импорты базы
            знаний.
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={fileType} onValueChange={handleFileTypeChange}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все типы</SelectItem>
              <SelectItem value="AVATAR">AVATAR</SelectItem>
              <SelectItem value="CHAT_ATTACHMENT">CHAT_ATTACHMENT</SelectItem>
              <SelectItem value="IMAGE_ATTACHMENT">IMAGE_ATTACHMENT</SelectItem>
              <SelectItem value="AUDIO_ATTACHMENT">AUDIO_ATTACHMENT</SelectItem>
              <SelectItem value="VIDEO_ATTACHMENT">VIDEO_ATTACHMENT</SelectItem>
              <SelectItem value="DOCUMENT_ATTACHMENT">
                DOCUMENT_ATTACHMENT
              </SelectItem>
              <SelectItem value="KNOWLEDGE_IMPORT">KNOWLEDGE_IMPORT</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => filesQuery.refetch()}
            disabled={filesQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Обновить
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список файлов</CardTitle>
        </CardHeader>

        <CardContent>
          {filesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : null}

          {filesQuery.isError ? (
            <p className="text-sm text-destructive">Ошибка загрузки файлов</p>
          ) : null}

          {!filesQuery.isLoading && !filesQuery.isError ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Файл</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Размер</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="font-medium">{file.originalName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {file.s3Key}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.mimeType}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">{file.fileType}</Badge>
                    </TableCell>

                    <TableCell>{formatFileSize(file.sizeBytes)}</TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Badge>{file.uploadStatus}</Badge>
                        <div>
                          <Badge variant="outline">
                            {file.processingStatus}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {new Date(file.createdAt).toLocaleString("ru-RU")}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadMutation.mutate(file.id)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Скачать
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            const confirmed = window.confirm(
                              `Удалить файл "${file.originalName}"?`,
                            );

                            if (confirmed) {
                              deleteMutation.mutate(file.id);
                            }
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {files.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Файлов пока нет
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
