import { PageLayout } from "@/layouts";

const Dashboard = () => {
  return (
    <PageLayout
      title="Dashboard"
      description="Configure your providers and use the assistant with your own API keys."
    >
      <div className="rounded-xl border border-border/70 p-5 text-sm text-muted-foreground">
        Hey Frank is free to use. Open Dev space to select an AI provider, enter
        its API key, and choose a model.
      </div>
    </PageLayout>
  );
};

export default Dashboard;
