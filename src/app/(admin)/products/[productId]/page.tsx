import ProductEditorPage from "@/components/admin/pages/ProductEditorPage";

export default async function ProductDetailRoutePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <ProductEditorPage productId={productId} />;
}
