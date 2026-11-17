import type { Metadata } from "next";
import { Resolve } from "@/components/dashboard/resolve";
import { notFound } from "next/navigation";
import { Composer } from "@/components/social/composer";
import { PublishingPage } from "@/components/social/loader";

export const metadata: Metadata = { title: "Edit post" };

/** Only the signed-in customer's own posts are ever loaded; anything else is a 404. */
export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Resolve value={params}>
      {({ id }) => (
        <PublishingPage
          render={(data) => {
            const post = data.posts.find((p) => p.id === id);
            if (!post) notFound();
            return <Composer key={post.id + post.updatedAt} data={data} post={post} />;
          }}
        />
      )}
    </Resolve>
  );
}
