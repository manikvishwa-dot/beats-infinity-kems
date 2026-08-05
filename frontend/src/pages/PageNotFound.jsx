import { Link } from "react-router-dom";

function PageNotFound() {
  return (
    <div
      style={{
        padding: "80px",
        textAlign: "center",
      }}
    >
      <h1>404</h1>

      <h2>Page Not Found</h2>

      <p>The page you are looking for doesn't exist.</p>

      <Link to="/">Go Back Home</Link>
    </div>
  );
}

export default PageNotFound;