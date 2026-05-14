import type { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiDocument } from './openapi';

export function mountSwagger(app: Application): void {
  const spec = generateOpenApiDocument();

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'MicroDo API Docs',
    }),
  );

  app.get('/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(spec);
  });
}
