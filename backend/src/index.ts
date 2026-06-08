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
import { requireAuth } from './middleware/requireAuth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use('/api/auth', authRouter);

app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/resources', requireAuth, resourcesRouter);
app.use('/api/projects/:id/dashboard', requireAuth, dashboardRouter);
app.use('/api/projects/:id/baseline', requireAuth, baselineRouter);
app.use('/api/projects/:id/phases', requireAuth, phasesRouter);
app.use('/api/projects/:id/gantt', requireAuth, ganttRouter);
app.use('/api/projects/:id/allocation', requireAuth, allocationsRouter);
app.use('/api/projects/:id/ongoing', requireAuth, ongoingRouter);
app.use('/api/phase-templates', requireAuth, phaseTemplatesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
