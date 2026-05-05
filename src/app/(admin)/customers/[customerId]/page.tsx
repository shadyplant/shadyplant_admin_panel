import CustomerEditorPage from "@/components/admin/pages/CustomerEditorPage";

export default async function CustomerDetailRoutePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return <CustomerEditorPage customerId={customerId} />;
}
