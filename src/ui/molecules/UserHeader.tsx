import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "../atoms/Avatar";
import { Skeleton } from "../atoms/Skeleton";

type Props = {
  loading?: boolean;
  avatarUrl?: string | null;
  initial?: string;
  name?: string;
  meta?: ReactNode;
  nameSuffix?: ReactNode;
};

export const UserHeader = ({
  loading = false,
  avatarUrl,
  initial,
  name,
  meta,
  nameSuffix
}: Props) => {
  const showSkeleton = loading && !name;

  return (
    <div className="eleven-user-header">
      {showSkeleton ? (
        <div className="avatar">
          <Skeleton variant="avatar" />
        </div>
      ) : (
        <Avatar src={avatarUrl ?? undefined} initial={initial ?? name} alt={name ?? ""} />
      )}
      <div className="eleven-user-meta">
        <div className="eleven-user-name-row">
          {showSkeleton ? (
            <Skeleton
              variant="line"
              lineSize="main"
              style={{ "--skeleton-line-height": "10px" } as CSSProperties}
            />
          ) : name ? (
            <div className="eleven-user-name">{name}</div>
          ) : null}
          {showSkeleton ? (
            <Skeleton
              variant="line"
              lineSize="small"
              style={{ "--skeleton-line-height": "8px" } as CSSProperties}
            />
          ) : (
            nameSuffix
          )}
        </div>
        {!showSkeleton && meta}
      </div>
    </div>
  );
};
