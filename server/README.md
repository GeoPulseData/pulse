

```sh
$ GeoPulse --key YOUR_API_KEY --port 8090
```

```sh
# Option 1: Command line argument
deno run main.ts --key YOUR_API_KEY --port 8090

# Option 2: Create a .geopulse.key file
echo "YOUR_API_KEY" > .geopulse.key
deno run main.ts --port 8090
```
