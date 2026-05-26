# Add Swap Space (optional but recommended for large typechecks)

If your server has limited RAM, adding swap can prevent tsc from OOM-killing.

Run these commands as root (or with sudo):

```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h
```

To persist across reboots, add to `/etc/fstab`:

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Notes:
- Choose swap size based on your disk space and memory needs. 8G is a common safe choice for an 8GB VM.
- Swap is slower than RAM; prefer adding physical RAM when possible.
