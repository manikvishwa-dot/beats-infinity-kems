import Navbar from "../components/common/Navbar";

function Home() {
  return (
    <>
      <Navbar />

      <div
        style={{
          padding: "80px",
          textAlign: "center",
        }}
      >
        <h1>🎤 Welcome to Beats Infinity</h1>

        <h2>Unleash the Harmony in You</h2>

        <p>
          Chennai's Premium Karaoke Community
        </p>
      </div>
    </>
  );
}

export default Home;