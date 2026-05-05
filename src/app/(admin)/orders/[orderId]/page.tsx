import OrderEditorPage from "@/components/admin/pages/OrderEditorPage";

export default async function OrderDetailRoutePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderEditorPage orderId={orderId} />;
}
