const logger = (req, res, next) => {
    console.log(
      `A request from ${req.hostname} || ${req.method} - ${
        req.url
      } at ${new Date().toLocaleTimeString()}`
    );
    next();
  };
  
  export default logger;
  