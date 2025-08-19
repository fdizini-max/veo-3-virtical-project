import { GenerationForm } from '@/components/GenerationForm';

export default function HomePage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-center mb-8">
        Vertical-first Veo 3 Generator
      </h1>
      <GenerationForm />
    </div>
  );
}