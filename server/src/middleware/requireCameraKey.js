export function requireCameraKey() {
  return (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env.CAMERA_API_KEY) {
      return res.status(401).json({ error: "API key de cámara inválida" });
    }
    next();
  };
}
