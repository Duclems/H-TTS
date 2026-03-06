type Props = {
  children: React.ReactNode;
  id?: string;
  as?: "div" | "h2";
};

export const CardTitle = ({ children, id, as: Tag = "div" }: Props) => {
  return (
    <Tag id={id} className="card-title">
      {children}
    </Tag>
  );
};
