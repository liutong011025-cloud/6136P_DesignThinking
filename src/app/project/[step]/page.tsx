import { notFound } from "next/navigation";
import { STEPS } from "@/lib/course";
import { Workspace } from "@/components/workspace";
export default async function ProjectPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!STEPS.some(s => s.key === step)) notFound();
  return <Workspace step={step} />;
}
