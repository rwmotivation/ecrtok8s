import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";

// Create an ECR repository
const ecrRepository = new aws.ecr.Repository("myecrrepo");

// Get the ECR repository URL
const ecrRepositoryUrl = pulumi.interpolate`${ecrRepository.repositoryUrl}`;

// Create a Kubernetes namespace
const namespace = new k8s.core.v1.Namespace("my-namespace", {
    metadata: { name: "my-namespace" },
});

// Create a Kubernetes Secret for pulling from ECR
const ecrSecret = new k8s.core.v1.Secret("ecr-secret", {
    metadata: { namespace: namespace.metadata.name },
    type: "kubernetes.io/dockerconfigjson",
    data: {
        ".dockerconfigjson": pulumi.output(aws.ecr.getCredentials({ registryIds: [ecrRepository.registryId] })).apply(
            credentials => Buffer.from(JSON.stringify(credentials.authorizationToken)).toString("base64")
        ),
    },
});

// Create a Kubernetes Deployment
const appLabels = { app: "my-app" };
const deployment = new k8s.apps.v1.Deployment("my-deployment", {
    metadata: { namespace: namespace.metadata.name },
    spec: {
        replicas: 1,
        selector: { matchLabels: appLabels },
        template: {
            metadata: { labels: appLabels },
            spec: {
                containers: [
                    {
                        name: "my-container",
                        image: ecrRepositoryUrl,
                        ports: [{ containerPort: 80 }],
                    },
                ],
            },
        },
    },
});

// Export the Kubernetes deployment details
export const deploymentName = deployment.metadata.name;
export const namespaceName = namespace.metadata.name;
