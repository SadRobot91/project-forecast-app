import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import resourcesRouter from './routes/resources';
import allocationsRouter from './routes/allocations';
import ongoingRouter from './routes/ongoing';
import baselineRouter from './routes/baseline';
import phasesRouter from './routes/phases';
import ganttRouter from './routes/gantt';
import projectsRouter from './routes/projects';
import dashboardRouter from './routes/dashboard';
import phaseTemplatesRouter from './routes/phaseTemplates';
import authRouter from './routes/auth';
import knowledgeRouter from './routes/knowledge';
import intelligenceRouter from './routes/intelligence';
import { requireAuth } from './middleware/requireAuth';
import { requireProjectAccess } from './middleware/requireProjectAccess';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins }));

app.use('/api/auth', authRouter);

// Guard unico per tutte le risorse-progetto: autentica e verifica che il
// progetto :id appartenga al PM (il DM accede a tutto). Montato sul prefisso,
// copre anche le route figlie (dashboard, baseline, gantt, ...).
app.use('/api/projects/:id', requireAuth, requireProjectAccess);

app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/projects/:id', knowledgeRouter);
app.use('/api/projects/:id', intelligenceRouter);
app.use('/api/resources', requireAuth, resourcesRouter);
app.use('/api/projects/:id/dashboard', dashboardRouter);
app.use('/api/projects/:id/baseline', baselineRouter);
app.use('/api/projects/:id/phases', phasesRouter);
app.use('/api/projects/:id/gantt', ganttRouter);
app.use('/api/projects/:id/allocation', allocationsRouter);
app.use('/api/projects/:id/ongoing', ongoingRouter);
app.use('/api/phase-templates', requireAuth, phaseTemplatesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// In esecuzione diretta (dev/nodemon, node dist/index.js) avvia il server;
// quando il modulo è importato (@vercel/node, test) espone solo l'app.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app;
