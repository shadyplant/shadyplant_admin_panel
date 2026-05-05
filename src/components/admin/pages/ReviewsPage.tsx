"use client";

import { useEffect, useState } from "react";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminEmptyCard,
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminReview, ApiResponse } from "@/lib/admin-api";
import { formatAdminDate } from "@/lib/admin-utils";

export default function ReviewsPage() {
  const { authorizedRequest } = useAdminAuth();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReviews() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ reviews: AdminReview[] }>>(
          statusFilter === "all"
            ? "/admin/reviews"
            : `/admin/reviews?status=${encodeURIComponent(statusFilter)}`,
        );
      setReviews(response.data.reviews);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load reviews.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncReviews() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ reviews: AdminReview[] }>>(
            statusFilter === "all"
              ? "/admin/reviews"
              : `/admin/reviews?status=${encodeURIComponent(statusFilter)}`,
          );

        if (!cancelled) {
          setReviews(response.data.reviews);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load reviews.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncReviews();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, statusFilter]);

  async function handleUpdateStatus(reviewId: string, status: string) {
    setActioningId(reviewId);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ review: AdminReview }>>(
          `/admin/reviews/${reviewId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status }),
          },
        );

      setReviews((currentReviews) =>
        currentReviews.map((review) =>
          review.id === reviewId ? response.data.review : review,
        ),
      );
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update review status.",
      );
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(reviewId: string) {
    const shouldDelete = window.confirm("Delete this review permanently?");

    if (!shouldDelete) {
      return;
    }

    setActioningId(reviewId);

    try {
      await authorizedRequest(`/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });
      setReviews((currentReviews) =>
        currentReviews.filter((review) => review.id !== reviewId),
      );
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete review.",
      );
    } finally {
      setActioningId(null);
    }
  }

  const filteredReviews = reviews.filter((review) =>
    [
      review.title,
      review.body,
      review.authorName,
      review.authorLocation,
      review.productId,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedReviews = filteredReviews.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (loading) {
    return <AdminLoadingCard label="Loading reviews..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadReviews} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Moderation"
        title="Reviews"
        description="Review real customer ratings, approve or reject submissions, and keep product sentiment trustworthy before it reaches the storefront."
      />

      <AdminPanel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <AdminTextInput
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by author, title, review body, or product id"
              className="max-w-xl"
            />
            <AdminSelect
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="md:w-[220px]"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </AdminSelect>
          </div>
          <p className="text-sm font-semibold text-[var(--admin-muted)]">
            {reviews.length} review records
          </p>
        </div>
      </AdminPanel>

      {!filteredReviews.length ? (
        <AdminEmptyCard
          title="No reviews found"
          description="Adjust the filter or search term. Approved and pending reviews will show here."
        />
      ) : (
        <div className="space-y-4">
          {paginatedReviews.map((review) => (
            <AdminPanel key={review.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                      {review.title || "Untitled review"}
                    </h2>
                    <AdminStatusPill status={review.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--admin-muted)]">
                    {review.authorName} | {review.authorLocation || "Location not shared"} | Product{" "}
                    {review.productId}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--admin-ink)]">
                    {review.body}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                    {review.rating}/5 rating | {review.verifiedBuyer ? "Verified buyer" : "Unverified"} |{" "}
                    {formatAdminDate(review.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <AdminActionButton
                    tone="primary"
                    onClick={() => handleUpdateStatus(review.id, "approved")}
                    disabled={actioningId === review.id}
                  >
                    Approve
                  </AdminActionButton>
                  <AdminActionButton
                    tone="secondary"
                    onClick={() => handleUpdateStatus(review.id, "rejected")}
                    disabled={actioningId === review.id}
                  >
                    Reject
                  </AdminActionButton>
                  <AdminActionButton
                    tone="danger"
                    onClick={() => handleDelete(review.id)}
                    disabled={actioningId === review.id}
                  >
                    Delete
                  </AdminActionButton>
                </div>
              </div>
            </AdminPanel>
          ))}
          <AdminPagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredReviews.length}
            pageSize={pageSize}
            label="reviews"
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
