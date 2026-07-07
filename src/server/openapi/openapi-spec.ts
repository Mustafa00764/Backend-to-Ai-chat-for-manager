import { env } from '@/lib/env'

export function createOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Manager AI Platform API',
      version: '1.0.0',
      description:
        'Backend API для Expo приложения менеджеров, админки, AI-чата, файлов, диктофона, базы знаний и RAG.'
    },
    servers: [
      {
        url: env.NEXT_PUBLIC_APP_URL,
        description: 'Current app URL'
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Проверка сервера'
      },
      {
        name: 'Mobile Auth',
        description: 'Профиль и настройки пользователя в Expo'
      },
      {
        name: 'Mobile Chats',
        description: 'Чаты и сообщения Expo приложения'
      },
      {
        name: 'Mobile Files',
        description: 'Файлы и вложения Expo приложения'
      },
      {
        name: 'Mobile Speech',
        description: 'Диктофон и speech-to-text'
      },
      {
        name: 'Admin Users',
        description: 'Управление пользователями'
      },
      {
        name: 'Admin Chats',
        description: 'Просмотр чатов в админке'
      },
      {
        name: 'Admin Files',
        description: 'Просмотр и скачивание файлов'
      },
      {
        name: 'Admin Knowledge',
        description: 'База знаний, import, embeddings, pgvector search'
      },
      {
        name: 'Admin Settings',
        description: 'AI settings'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Clerk JWT',
          description:
            'Для Expo: Authorization: Bearer <Clerk token>. Для браузерной админки используется Clerk session cookie.'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string'
            },
            details: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            clerkId: {
              type: 'string'
            },
            email: {
              type: 'string'
            },
            name: {
              type: 'string',
              nullable: true
            },
            username: {
              type: 'string',
              nullable: true
            },
            role: {
              type: 'string',
              enum: ['ADMIN', 'MANAGER', 'USER']
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'DISABLED']
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Chat: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            userId: {
              type: 'string'
            },
            title: {
              type: 'string'
            },
            isPinned: {
              type: 'boolean'
            },
            isArchived: {
              type: 'boolean'
            },
            isDeleted: {
              type: 'boolean'
            },
            lastMessageAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            chatId: {
              type: 'string'
            },
            userId: {
              type: 'string',
              nullable: true
            },
            role: {
              type: 'string',
              enum: ['USER', 'ASSISTANT', 'SYSTEM']
            },
            content: {
              type: 'string'
            },
            responseMode: {
              type: 'string',
              enum: ['NORMAL', 'ADVANCED'],
              nullable: true
            },
            model: {
              type: 'string',
              nullable: true
            },
            metadata: {
              type: 'object',
              additionalProperties: true,
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        File: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            ownerId: {
              type: 'string'
            },
            bucket: {
              type: 'string'
            },
            s3Key: {
              type: 'string'
            },
            originalName: {
              type: 'string'
            },
            mimeType: {
              type: 'string'
            },
            extension: {
              type: 'string',
              nullable: true
            },
            sizeBytes: {
              type: 'number'
            },
            fileType: {
              type: 'string'
            },
            uploadStatus: {
              type: 'string'
            },
            processingStatus: {
              type: 'string'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        AiSettings: {
          type: 'object',
          properties: {
            chatModel: {
              type: 'string'
            },
            aiMockMode: {
              type: 'boolean'
            },
            ragEnabled: {
              type: 'boolean'
            },
            ragMaxChunks: {
              type: 'number'
            },
            ragMinScore: {
              type: 'number'
            },
            embeddingMockMode: {
              type: 'boolean'
            },
            embeddingModel: {
              type: 'string'
            },
            embeddingDimensions: {
              type: 'number'
            },
            asrModel: {
              type: 'string'
            },
            realtimeModel: {
              type: 'string'
            },
            realtimeVoice: {
              type: 'string'
            },
            updatedAt: {
              type: 'string',
              nullable: true
            }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Проверить состояние backend',
          security: [],
          responses: {
            '200': {
              description: 'Server is healthy'
            }
          }
        }
      },

      '/api/mobile/me': {
        get: {
          tags: ['Mobile Auth'],
          summary: 'Получить текущего пользователя',
          responses: {
            '200': {
              description: 'Current user',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: {
                        $ref: '#/components/schemas/User'
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Unauthorized'
            }
          }
        },
        patch: {
          tags: ['Mobile Auth'],
          summary: 'Обновить профиль текущего пользователя',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string'
                    },
                    username: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Updated user'
            }
          }
        }
      },

      '/api/mobile/settings': {
        get: {
          tags: ['Mobile Auth'],
          summary: 'Получить настройки пользователя',
          responses: {
            '200': {
              description: 'User settings'
            }
          }
        },
        patch: {
          tags: ['Mobile Auth'],
          summary: 'Обновить настройки пользователя',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Updated settings'
            }
          }
        }
      },

      '/api/mobile/chats': {
        get: {
          tags: ['Mobile Chats'],
          summary: 'Получить список чатов пользователя',
          responses: {
            '200': {
              description: 'Chats list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      chats: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Chat'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Mobile Chats'],
          summary: 'Создать чат',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string',
                      example: 'Новый чат'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Created chat'
            }
          }
        }
      },

      '/api/mobile/chats/{chatId}': {
        get: {
          tags: ['Mobile Chats'],
          summary: 'Получить чат по ID',
          parameters: [
            {
              name: 'chatId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Chat details'
            }
          }
        },
        patch: {
          tags: ['Mobile Chats'],
          summary: 'Обновить чат',
          parameters: [
            {
              name: 'chatId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string'
                    },
                    isPinned: {
                      type: 'boolean'
                    },
                    isArchived: {
                      type: 'boolean'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Updated chat'
            }
          }
        },
        delete: {
          tags: ['Mobile Chats'],
          summary: 'Удалить чат мягко',
          parameters: [
            {
              name: 'chatId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Deleted chat'
            }
          }
        }
      },

      '/api/mobile/chats/{chatId}/messages': {
        get: {
          tags: ['Mobile Chats'],
          summary: 'Получить сообщения чата',
          parameters: [
            {
              name: 'chatId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Messages list'
            }
          }
        },
        post: {
          tags: ['Mobile Chats'],
          summary: 'Отправить сообщение и получить ответ Qwen/RAG',
          parameters: [
            {
              name: 'chatId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: {
                      type: 'string',
                      example:
                        'Клиент спрашивает про сэндвич-панели для холодного склада. Что ответить?'
                    },
                    responseMode: {
                      type: 'string',
                      enum: ['NORMAL', 'ADVANCED']
                    },
                    fileIds: {
                      type: 'array',
                      items: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'User message and assistant message'
            }
          }
        }
      },

      '/api/mobile/files': {
        get: {
          tags: ['Mobile Files'],
          summary: 'Получить файлы пользователя',
          parameters: [
            {
              name: 'type',
              in: 'query',
              required: false,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Files list'
            }
          }
        },
        post: {
          tags: ['Mobile Files'],
          summary: 'Загрузить файл',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary'
                    },
                    source: {
                      type: 'string',
                      example: 'chat_attachment'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Uploaded file'
            }
          }
        }
      },

      '/api/mobile/files/{fileId}': {
        get: {
          tags: ['Mobile Files'],
          summary: 'Получить файл по ID',
          parameters: [
            {
              name: 'fileId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'File'
            }
          }
        }
      },

      '/api/mobile/files/{fileId}/download': {
        get: {
          tags: ['Mobile Files'],
          summary: 'Получить signed download URL',
          parameters: [
            {
              name: 'fileId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Download URL'
            }
          }
        }
      },

      '/api/mobile/speech/dictation': {
        post: {
          tags: ['Mobile Speech'],
          summary: 'Диктофон: аудиофайл в backend, backend возвращает текст',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['audio'],
                  properties: {
                    audio: {
                      type: 'string',
                      format: 'binary'
                    },
                    chatId: {
                      type: 'string',
                      description:
                        'Если передан, распознанный текст сохранится как сообщение в чат.'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Transcribed text',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      text: {
                        type: 'string'
                      },
                      model: {
                        type: 'string'
                      },
                      audioFile: {
                        $ref: '#/components/schemas/File'
                      },
                      message: {
                        $ref: '#/components/schemas/Message'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/admin-api/users': {
        get: {
          tags: ['Admin Users'],
          summary: 'Список пользователей',
          responses: {
            '200': {
              description: 'Users list'
            }
          }
        },
        post: {
          tags: ['Admin Users'],
          summary: 'Создать пользователя',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'role'],
                  properties: {
                    email: {
                      type: 'string'
                    },
                    name: {
                      type: 'string'
                    },
                    role: {
                      type: 'string',
                      enum: ['ADMIN', 'MANAGER', 'USER']
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Created user'
            }
          }
        }
      },

      '/api/admin-api/users/{id}': {
        patch: {
          tags: ['Admin Users'],
          summary: 'Обновить пользователя',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Updated user'
            }
          }
        }
      },

      '/api/admin-api/chats': {
        get: {
          tags: ['Admin Chats'],
          summary: 'Админ: список всех чатов',
          responses: {
            '200': {
              description: 'Chats list'
            }
          }
        }
      },

      '/api/admin-api/chats/{chatId}': {
        get: {
          tags: ['Admin Chats'],
          summary: 'Админ: детали чата',
          parameters: [
            {
              name: 'chatId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Chat details'
            }
          }
        }
      },

      '/api/admin-api/files': {
        get: {
          tags: ['Admin Files'],
          summary: 'Админ: список файлов',
          responses: {
            '200': {
              description: 'Files list'
            }
          }
        }
      },

      '/api/admin-api/knowledge/import': {
        post: {
          tags: ['Admin Knowledge'],
          summary: 'Импортировать TXT/JSONL базу знаний',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary'
                    },
                    title: {
                      type: 'string'
                    },
                    channel: {
                      type: 'string',
                      example: 'CHAT'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Imported knowledge source'
            }
          }
        }
      },

      '/api/admin-api/knowledge/sources': {
        get: {
          tags: ['Admin Knowledge'],
          summary: 'Список источников базы знаний',
          responses: {
            '200': {
              description: 'Knowledge sources'
            }
          }
        }
      },

      '/api/admin-api/knowledge/embeddings': {
        get: {
          tags: ['Admin Knowledge'],
          summary: 'Статистика embeddings',
          responses: {
            '200': {
              description: 'Embedding stats'
            }
          }
        },
        post: {
          tags: ['Admin Knowledge'],
          summary: 'Создать embeddings для chunks',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'number',
                default: 10
              }
            }
          ],
          responses: {
            '200': {
              description: 'Embedding generation result'
            }
          }
        }
      },

      '/api/admin-api/knowledge/search': {
        get: {
          tags: ['Admin Knowledge'],
          summary: 'pgvector search по базе знаний',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              }
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'number',
                default: 5
              }
            }
          ],
          responses: {
            '200': {
              description: 'Search results'
            }
          }
        }
      },

      '/api/admin-api/settings/ai': {
        get: {
          tags: ['Admin Settings'],
          summary: 'Получить AI settings',
          responses: {
            '200': {
              description: 'AI settings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      settings: {
                        $ref: '#/components/schemas/AiSettings'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        patch: {
          tags: ['Admin Settings'],
          summary: 'Обновить AI settings',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AiSettings'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Updated AI settings'
            }
          }
        }
      }
    }
  }
}
