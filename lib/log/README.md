# LOG Service

Common endpoint which merges all logs into single place

## Principle

Has same interface as system `console` module like this:

  - `console.info()`
  - `console.log()`
  - `console.warn()`
  - `console.error()`

So it's ok to implement service this way:

```javascript
module.exports = console;
```