import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import AppNav from './AppNav';

const ProjectNameContext = createContext<(name: string) => void>(() => {});

export function useSetProjectName(): (name: string) => void {
  return useContext(ProjectNameContext);
}

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>();
  const [projectName, setProjectName] = useState<string | undefined>();

  // cambio progetto senza smontare il layout → niente nome stale
  useEffect(() => { setProjectName(undefined); }, [id]);

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <AppNav projectId={id} projectName={projectName} />
      <ProjectNameContext.Provider value={setProjectName}>
        <Outlet />
      </ProjectNameContext.Provider>
    </div>
  );
}
