import ServiceEditorPage from "@/components/admin/pages/ServiceEditorPage";

export default async function ServiceDetailRoutePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  return <ServiceEditorPage serviceId={serviceId} />;
}
