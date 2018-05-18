# Qubic.io
Qube website

## Windows

### Prerequisite
* Install MongoDB ~3.0.4

* create an empty directory "..\qube\db"

```dos
mongod.exe --dbpath c:\MongoDB\qube\db --logpath c:\MongoDB\Logs\qube.txt --install
net start MongoDB
```

### Install

```dos
git clone ssh://git@qubic.io/var/repo/qubic.git
cd qubic
npm install
npm run-script install-windows-service
net start qubic
```    

### Debug

```dos
npm run dev-win
```

## TODO
Use cached if not logged in. Cache if not logged in.
    http://www.djm.org.uk/wordpress-nginx-reverse-proxy-caching-setup/

## Collections

play
user_<username>
public_<collection_name>
private_<collection_name>


## API (run a qube expression in node/nodeService)

IGNORE: With the current document format and available libraries it is imposible to extract the qube expressions from a document
without slatejs (which doesn't run in node). We need to first extract the qube_expressions code from slatejs_qube


fetch the qube snapshot from http://qube.ims.uss.co.uk:3000/api/share/draft/90sd6ekpoy where 90sd6ekpoy is the doc id.


   var qube = require('qube');
   var ot = require('ot-sexpr');
   fetch = require('node-fetch');
   var q;
   fetch('http://qube.ims.uss.co.uk:3000/api/share/draft/90sd6ekpoy').then(d => { console.log(d)}) //doesn't work because requires authentication