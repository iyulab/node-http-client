# @iyulab-http-client

@iyulab/http-client는 HTTP 요청을 쉽게 처리할 수 있는 TypeScript 기반의 클라이언트 라이브러리입니다. 이 라이브러리는 다양한 HTTP 메서드를 지원하며, 요청을 취소하거나 파일 업로드 이벤트를 관리하는 기능을 제공합니다.

## 설치

npm을 사용하여 패키지를 설치할 수 있습니다:

```
npm install @iyulab/http-client
```

## 사용법

### HttpClient

`HttpClient` 클래스를 사용하여 HTTP 요청을 보낼 수 있습니다. 다음은 기본적인 사용 예시입니다:

```typescript
import { HttpClient } from '@iyulab/http-client';

const client = new HttpClient();

client.get('https://api.example.com/data')
  .then(response => {
    console.log(response);
  })
  .catch(error => {
    console.error(error);
  });
```

### CancelToken

HTTP 요청을 취소하려면 `CancelToken` 클래스를 사용할 수 있습니다:

```typescript
import { HttpClient, CancelToken } from '@iyulab/http-client';

const client = new HttpClient();
const cancelToken = new CancelToken();

client.get('https://api.example.com/data', { cancelToken })
  .then(response => {
    console.log(response);
  })
  .catch(error => {
    if (cancelToken.isCanceled) {
      console.log('Request was canceled');
    } else {
      console.error(error);
    }
  });

// 요청 취소
cancelToken.cancel();
```

## 클래스 설명

- **CancelToken**: HTTP 요청을 취소하는 기능을 제공합니다.
- **FileUploadEvent**: 파일 업로드 이벤트를 처리합니다.
- **HttpClient**: HTTP 요청을 보내고 응답을 처리합니다.
- **HttpMethod**: HTTP 메서드를 정의합니다.
- **HttpRequest**: HTTP 요청을 나타냅니다.
- **HttpResponse**: HTTP 응답을 나타냅니다.
- **TextStreamEvent**: 텍스트 스트림 이벤트를 처리합니다.

## 기여

기여를 원하신다면, 이 저장소를 포크하고 풀 리퀘스트를 제출해 주세요.

## 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.
