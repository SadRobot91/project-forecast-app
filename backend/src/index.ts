import express from 'express';
import dotenv from 'dotenv';
import resourcesRouter from './routes/resources';
import allocationsRouter from './routes/allocations';
import ongoingRouter from './routes/ongoing';
import baselineRouter from './routes/baseline';
import ganttRouter from './routes/gantt';
import projectsRouter from './routes/projects';
import dashboardRouter from './routes/dashboard';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/projects/:id/dashboard', dashboardRouter);
app.use('/api/projects/:id/baseline', baselineRouter);
app.use('/api/projects/:id/gantt', ganttRouter);
app.use('/api/projects/:id/allocation', allocationsRouter);
app.use('/api/projects/:id/ongoing', ongoingRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
