FROM debian:trixie-slim

ARG USERNAME=avr
ARG USER_UID=1000
ARG USER_GID=1000


ENV TZ=Europe/Berlin

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone 

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    gcc-avr \
    binutils-avr \
    avr-libc \
    avrdude \
    make \
    libftdi1 libftdi1-2 \
    libserialport0 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*


RUN groupadd -g ${USER_GID} ${USERNAME} \
    && useradd -m -u ${USER_UID} -g ${USER_GID} -s /bin/bash ${USERNAME} \
    && mkdir -p /workspace && chown ${USERNAME}:${USERNAME} /workspace 
    
# Create working directory
WORKDIR /workspace

# Default command
CMD ["/bin/bash"]

